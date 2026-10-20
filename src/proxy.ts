import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_ON, SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/** Referral (?ref=) and creator (?code=) links, remembered for 30 days (see lib/referral). */
const CARRIED = [["ref", "tf_ref"], ["code", "tf_promo"]] as const;

function carryCodes(req: NextRequest, res: NextResponse) {
  for (const [param, cookie] of CARRIED) {
    const v = req.nextUrl.searchParams.get(param)?.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
    if (v) res.cookies.set(cookie, v, { maxAge: 30 * 24 * 60 * 60, path: "/", sameSite: "lax", httpOnly: true });
  }
  return res;
}

/** Refresh the Supabase session once per navigation so server code sees a valid login. */
export async function proxy(req: NextRequest) {
  if (!AUTH_ON) return carryCodes(req, NextResponse.next());
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll(toSet, headers) {
        for (const { name, value } of toSet) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of toSet) res.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
      },
    },
  });
  await supabase.auth.getClaims();
  return carryCodes(req, res);
}

export const config = {
  // Pages and the API routes that check access; skip static files, images and the crons.
  matcher: ["/((?!_next/|api/cron|api/inseason/refresh|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|txt|xml)$).*)"],
};
