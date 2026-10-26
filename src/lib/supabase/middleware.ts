import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEMO_COOKIE } from "@/lib/constants";
import { logServerError } from "@/lib/log";
import { getSupabasePublicEnv } from "./config";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/activity",
  "/settings",
  "/stores",
  "/vouchers",
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function updateSession(request: NextRequest) {
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

  const demo = request.cookies.get(DEMO_COOKIE)?.value === "1";
  if (!userId && !demo && isProtectedPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  return supabaseResponse;
}
