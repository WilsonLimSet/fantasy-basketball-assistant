import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { track } from "@vercel/analytics/server";
import { cookies } from "next/headers";
import { kvStore } from "@/lib/inseason/storage";
import { recordFunnel } from "@/lib/funnel";
import { cleanCode, REF_COOKIE, rewardReferral } from "@/lib/referral";
import { stopWeeklyFor } from "@/lib/subscription";
import { accessFor, checkoutAccessEnd, isWeeklyCheckout, checkLicense, currentAccount, linkPassToAccount, makePass, PASS_COOKIE, passCookieOptions, SEASON_END } from "@/lib/auth";

/**
 * GET  /api/unlock?session_id=cs_...  -> Stripe Payment Link success redirect. Verifies the
 *      Checkout Session with Stripe, sets the pass cookie, returns to /unlocked (which reads the cookie,
 *      so the email and license key never appear in a URL, browser history or analytics).
 * POST /api/unlock {email, key}        -> restore on a new device with the license key (while the pass lasts).
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
  }).catch(() => null);
  // Stripe itself failed (outage, rate limit, network): they may well have paid, so don't show the paywall again.
  if (!r || (!r.ok && (r.status === 429 || r.status >= 500))) return NextResponse.redirect(new URL("/inseason?unlock=pending", u));
  const s = await r.json();
  const email: string | undefined = s?.customer_details?.email ?? s?.customer_email;
  // Must be a completed, paid session from one of our pass links, and the pass must still be running.
  const until = r.ok ? await checkoutAccessEnd(s).catch(() => null) : null;
  if (!r.ok || s.status !== "complete" || s.payment_status !== "paid" || !email || !until || until < Date.now()) {
    return NextResponse.redirect(new URL("/inseason?unlock=unpaid", u));
  }
  // Each checkout unlocks once, so a shared or leaked return link can't unlock other browsers or
  // accounts. The claim is atomic (two browsers at once can't both win) and fails closed; either
  // way the buyer gets in anywhere by signing in with their checkout email.
  let won: boolean;
  try {
    won = await kvStore().claim(`unlock:claimed:${sid}`, Date.now());
  } catch (e) {
    console.error("[unlock] claim failed", e);
    return NextResponse.redirect(new URL("/inseason?unlock=pending", u));
  }
  if (!won) return NextResponse.redirect(new URL("/inseason?unlock=used", u));
  // The season covers everything the weekly subscription did, so stop it renewing.
  if (until === SEASON_END) await stopWeeklyFor(email).catch((e) => console.error("[unlock] stop weekly failed", e));
  const account = await currentAccount();
  // Bought through a friend's referral link: the friend gets a week, and so does the buyer.
  const jar = await cookies();
  const bonus = await rewardReferral(cleanCode(jar.get(REF_COOKIE)?.value), email, account?.email ?? null).catch((e) => { console.error("[unlock] referral failed", e); return 0; });
  const end = until + bonus * 24 * 60 * 60 * 1000;
  if (bonus) await linkPassToAccount(email, end).catch((e) => console.error("[unlock] bonus failed", e));
  // Signed in under a different email than the checkout one? The pass is theirs as well.
  if (account && account.email !== email.toLowerCase()) await linkPassToAccount(account.email, end).catch((e) => console.error("[unlock] link failed", e));
  const res = NextResponse.redirect(new URL(bonus ? "/unlocked?bonus=1" : "/unlocked", u));
  res.cookies.set(PASS_COOKIE, makePass(email, end), { ...passCookieOptions, expires: new Date(end) });
  if (bonus) res.cookies.delete(REF_COOKIE);
  // Credited to the visitor's first source when the browser has our funnel cookie.
  const vid = jar.get("tf_vid")?.value?.replace(/[^a-z0-9]/gi, "") || createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 32);
  await recordFunnel("purchase", vid, "", req.headers.get("x-vercel-ip-country") ?? "").catch((e) => console.error("[unlock] funnel", e));
  await track("purchase", { plan: until === SEASON_END ? "season" : isWeeklyCheckout(s) ? "weekly" : "week", referred: bonus > 0 }).catch(() => {});
  return res;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; key?: string; code?: string };
  let email: string | null = null;
  let until = SEASON_END;
  if (body.code) {
    const codes = (process.env.CV_ACCESS_CODES ?? "").split(",").map((c) => c.trim()).filter(Boolean);
    // The cookie body is readable, so store a short hash of the code rather than the code itself.
    if (codes.includes(body.code.trim())) email = `code:${createHash("sha256").update(body.code.trim()).digest("hex").slice(0, 12)}`;
  } else if (body.email && body.key && checkLicense(body.email, body.key)) {
    // The key proves the email; Stripe says how long its pass runs.
    const pass = await accessFor(body.email);
    if (pass?.until) { email = body.email; until = pass.until; }
  }
  if (!email) return NextResponse.json({ ok: false, error: "That email/key or code didn't match." }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PASS_COOKIE, makePass(email, until), { ...passCookieOptions, expires: new Date(until) });
  return res;
}
