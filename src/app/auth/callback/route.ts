import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  isOAuthPrefetch,
  loginErrorLocation,
  oauthErrorCode,
  pkceFlowId,
  shouldExchangeOAuthCode,
} from "@/lib/auth/oauth-callback";
import { safeInternalPath } from "@/lib/auth/safe-next";
import { DEMO_COOKIE } from "@/lib/constants";
import { logServerError } from "@/lib/log";
import { getSupabasePublicEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PendingCookie = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

/**
 * Same-site redirect with a relative Location. On Netlify, request.url carries
 * the internal deploy host (main--<site>.netlify.app), so an absolute redirect
 * built from it sends the browser to a different host than the one that just
 * received the session cookies, and the user looks signed out.
 */
function redirectTo(url: URL, pending: PendingCookie[]) {
  const response = new NextResponse(null, {
    status: 307,
    headers: { Location: `${url.pathname}${url.search}${url.hash}` },
  });
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
      error: code ? null : oauthErrorCode(searchParams),
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

    // A real session replaces leftover demo mode, or the app keeps showing demo data.
    const success = redirectTo(new URL(nextPath, origin), pending);
    success.cookies.set(DEMO_COOKIE, "", { path: "/", maxAge: 0, sameSite: "lax" });
    return success;
  } catch (error) {
    logServerError("auth-callback", error);
    return redirectTo(failureUrl, pending);
  }
}
