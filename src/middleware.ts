import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_ON, SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/** Refresh the Supabase session once per navigation so server code sees a valid login. */
export async function middleware(req: NextRequest) {
  if (!AUTH_ON) return NextResponse.next();
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
  return res;
}

export const config = {
  // Pages and the API routes that check access; skip static files, images and the cron.
  matcher: ["/((?!_next/|api/cron|api/inseason|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|txt|xml)$).*)"],
};
