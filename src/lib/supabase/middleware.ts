import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  loginLocationFor,
  proxySkipsSessionRefresh,
  signedInEntryRedirect,
} from "@/lib/auth/oauth-callback";
import { DEMO_COOKIE } from "@/lib/constants";
import { logServerError } from "@/lib/log";
import { getSupabasePublicEnv } from "./config";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/activity",
  "/settings",
  "/stores",
  "/vouchers",
  "/join",
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function redirectKeepingCookies(url: URL, supabaseResponse: NextResponse) {
  const redirectResponse = NextResponse.redirect(url);
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });
  return redirectResponse;
}

export async function updateSession(request: NextRequest) {
  if (proxySkipsSessionRefresh(request.nextUrl.pathname)) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });
  const env = getSupabasePublicEnv();
  if (!env) return supabaseResponse;

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  let userId: string | null = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error && error.name !== "AuthSessionMissingError") {
      logServerError("auth", error);
    }
    userId = data.user?.id ?? null;
  } catch (error) {
    logServerError("auth", error);
    return supabaseResponse;
  }

  const entry = signedInEntryRedirect(
    request.nextUrl.pathname,
    userId,
    request.nextUrl.searchParams.get("next"),
  );
  if (entry) {
    return redirectKeepingCookies(new URL(entry, request.url), supabaseResponse);
  }

  const demo = request.cookies.get(DEMO_COOKIE)?.value === "1";
  if (!userId && !demo && isProtectedPath(request.nextUrl.pathname)) {
    const location = loginLocationFor(request.nextUrl.pathname, request.nextUrl.search);
    return redirectKeepingCookies(new URL(location, request.url), supabaseResponse);
  }

  return supabaseResponse;
}
