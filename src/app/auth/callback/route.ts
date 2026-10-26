import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  isOAuthPrefetch,
  loginErrorLocation,
  pkceFlowId,
  shouldExchangeOAuthCode,
} from "@/lib/auth/oauth-callback";
import { safeInternalPath } from "@/lib/auth/safe-next";
import { logServerError } from "@/lib/log";
import { getSupabasePublicEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PendingCookie = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

function redirectTo(url: URL, pending: PendingCookie[]) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "private, no-store");
  for (const cookie of pending) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}

/**
 * OAuth PKCE callback. The auth code is single-use. Chrome on iOS (and some
 * platform retries) request this URL twice: the first POST /token?grant_type=pkce
 * succeeds, and the second fails with flow_state_not_found. A failed exchange
 * must not win when a session is already present.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextPath = safeInternalPath(searchParams.get("next"));
  const prefetch = isOAuthPrefetch(request.headers);

  if (prefetch) {
    return new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const failureUrl = new URL(
    loginErrorLocation({
      error: code ? null : searchParams.get("error"),
      description: code ? null : searchParams.get("error_description"),
    }),
    origin,
  );

  const env = getSupabasePublicEnv();
  if (!env) return redirectTo(failureUrl, []);

  const pending: PendingCookie[] = [];
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(env.url, env.anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
            pending.push({ name, value, options });
          });
        },
      },
    });

    const sessionExists = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error && error.name !== "AuthSessionMissingError") {
        logServerError("auth-callback", error);
      }
      return Boolean(data.user);
    };

    const hasSession = await sessionExists();
    if (
      code &&
      shouldExchangeOAuthCode({
        hasCode: true,
        prefetch,
        hasSession,
      })
    ) {
      const flowId = pkceFlowId(searchParams.get("sb_flow_id"));
      const { error } = await supabase.auth.exchangeCodeForSession(
        code,
        flowId ? { flowId } : undefined,
      );
      if (error) {
        const errorCode =
          "code" in error && typeof error.code === "string" ? error.code : "unknown";
        logServerError("auth-callback", `exchange failed code=${errorCode}`);
        if (!(await sessionExists())) return redirectTo(failureUrl, pending);
      }
    } else if (!hasSession) {
      return redirectTo(failureUrl, pending);
    }

    return redirectTo(new URL(nextPath, origin), pending);
  } catch (error) {
    logServerError("auth-callback", error);
    return redirectTo(failureUrl, pending);
  }
}
