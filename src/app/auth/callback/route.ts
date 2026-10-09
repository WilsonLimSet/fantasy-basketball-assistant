import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** Where Google sign-in and email links land: trade the code for a session, then go back to the app. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const code = u.searchParams.get("code");
  const next = u.searchParams.get("next");
  const dest = next?.startsWith("/") && !next.startsWith("//") ? next : "/draft";
  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(dest, u));
  }
  return NextResponse.redirect(new URL("/login?error=1", u));
}
