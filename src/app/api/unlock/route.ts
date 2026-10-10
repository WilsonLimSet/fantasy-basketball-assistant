import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { checkLicense, makePass, PASS_COOKIE, passCookieOptions } from "@/lib/auth";

/**
 * GET  /api/unlock?session_id=cs_...  -> Stripe Payment Link success redirect. Verifies the
 *      Checkout Session with Stripe, sets the pass cookie, returns to /unlocked (which reads the cookie,
 *      so the email and license key never appear in a URL, browser history or analytics).
 * POST /api/unlock {email, key}        -> restore on a new device with the license key.
 * POST /api/unlock {code}              -> comp codes (CV_ACCESS_CODES, comma-separated) for friends/testing.
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const sid = u.searchParams.get("session_id");
  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sid || !sk) return NextResponse.redirect(new URL("/draft?unlock=error", u));
  const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sid)}`, {
    headers: { Authorization: `Bearer ${sk}` },
    cache: "no-store",
  });
  const s = await r.json();
  const email: string | undefined = s?.customer_details?.email ?? s?.customer_email;
  // Must be a completed, paid session from our own Payment Link (not some other product on the account).
  const ourLink = process.env.STRIPE_PAYMENT_LINK_ID;
  if (!r.ok || s.status !== "complete" || s.payment_status !== "paid" || !email || (ourLink && s.payment_link !== ourLink)) {
    return NextResponse.redirect(new URL("/draft?unlock=unpaid", u));
  }
  const res = NextResponse.redirect(new URL("/unlocked", u));
  res.cookies.set(PASS_COOKIE, makePass(email), passCookieOptions);
  return res;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; key?: string; code?: string };
  let email: string | null = null;
  if (body.code) {
    const codes = (process.env.CV_ACCESS_CODES ?? "").split(",").map((c) => c.trim()).filter(Boolean);
    // The cookie body is readable, so store a short hash of the code rather than the code itself.
    if (codes.includes(body.code.trim())) email = `code:${createHash("sha256").update(body.code.trim()).digest("hex").slice(0, 12)}`;
  } else if (body.email && body.key && checkLicense(body.email, body.key)) {
    email = body.email;
  }
  if (!email) return NextResponse.json({ ok: false, error: "That email/key or code didn't match." }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PASS_COOKIE, makePass(email), passCookieOptions);
  return res;
}
