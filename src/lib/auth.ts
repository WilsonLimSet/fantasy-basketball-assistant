import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { AUTH_ON } from "./supabase/env";
import { supabaseServer } from "./supabase/server";

/**
 * Stateless season pass.
 *  - cookie `cv_pass` = base64url(email|expiryMs).signature
 *  - license key = first 12 chars of HMAC(email) (lets a buyer unlock on another device)
 * Set CV_SECRET in production.
 */
const SECRET = process.env.CV_SECRET ?? "dev-secret-change-me";
export const PASS_COOKIE = "cv_pass";
export const SEASON_END = Date.parse(process.env.CV_PASS_EXPIRES ?? "2027-07-01T00:00:00Z");
export const FREE_LIMIT = Number(process.env.CV_FREE_LIMIT ?? 50);
/**
 * The paywall only applies once payments are set up (STRIPE_PAYMENT_LINK) or it is forced with
 * CV_PAYWALL=on. Until then everyone gets the full product.
 */
export const PAYWALL_ON = !!process.env.STRIPE_PAYMENT_LINK || process.env.CV_PAYWALL === "on";

const sign = (s: string) => createHmac("sha256", SECRET).update(s).digest("base64url");

export function licenseKey(email: string) {
  const h = sign(`key:${email.trim().toLowerCase()}`).replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12);
  return `${h.slice(0, 4)}-${h.slice(4, 8)}-${h.slice(8, 12)}`;
}

export function checkLicense(email: string, key: string) {
  const a = Buffer.from(licenseKey(email)), b = Buffer.from(key.trim().toUpperCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

export function makePass(email: string) {
  const body = Buffer.from(`${email.trim().toLowerCase()}|${SEASON_END}`).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readPass(value: string | undefined): { email: string } | null {
  if (!value) return null;
  const [body, sig] = value.split(".");
  if (!body || !sig) return null;
  const good = Buffer.from(sign(body)), got = Buffer.from(sig);
  if (good.length !== got.length || !timingSafeEqual(good, got)) return null;
  const [email, exp] = Buffer.from(body, "base64url").toString().split("|");
  if (!email || Number(exp) < Date.now()) return null;
  return { email };
}

/** Emails that get Pro for free when they sign in (FRIEND_EMAILS, comma-separated). */
const friendEmails = () => new Set((process.env.FRIEND_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));

const paidCache = new Map<string, { paid: boolean; at: number }>();
/** Did this email complete a Stripe checkout? Cached for 10 minutes (a yes for the season). */
async function paidOnStripe(email: string): Promise<boolean> {
  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) return false;
  const hit = paidCache.get(email);
  if (hit && (hit.paid || Date.now() - hit.at < 10 * 60 * 1000)) return hit.paid;
  try {
    const q = new URLSearchParams({ "customer_details[email]": email, limit: "10" });
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions?${q}`, { headers: { Authorization: `Bearer ${sk}` }, cache: "no-store" });
    if (!r.ok) return false;
    const j = (await r.json()) as { data?: { payment_status?: string }[] };
    const paid = !!j.data?.some((s) => s.payment_status === "paid");
    paidCache.set(email, { paid, at: Date.now() });
    return paid;
  } catch { return false; }
}

/** The signed-in account (Supabase), if auth is configured and the email is verified. */
export async function currentAccount(): Promise<{ email: string } | null> {
  if (!AUTH_ON) return null;
  try {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getClaims();
    const email = (data?.claims?.email as string | undefined)?.toLowerCase();
    return email ? { email } : null;
  } catch { return null; }
}

/**
 * Pro access, from any of: the season-pass cookie (paid or comp code), a signed-in friend on
 * FRIEND_EMAILS, or a signed-in account whose email paid on Stripe.
 */
export async function currentPass(): Promise<{ email: string; via: "pass" | "friend" | "stripe" } | null> {
  const jar = await cookies();
  const pass = readPass(jar.get(PASS_COOKIE)?.value);
  if (pass) return { ...pass, via: "pass" };
  const account = await currentAccount();
  if (!account) return null;
  if (friendEmails().has(account.email)) return { email: account.email, via: "friend" };
  if (await paidOnStripe(account.email)) return { email: account.email, via: "stripe" };
  return null;
}

export const passCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  expires: new Date(SEASON_END),
};
