import { NextResponse } from "next/server";
import { safeInternalPath } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth PKCE callback — exchanges ?code= for a session cookie, then redirects.
 * Used by Google (and any other) Supabase social login.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeInternalPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("google_auth_failed")}`,
  );
}
