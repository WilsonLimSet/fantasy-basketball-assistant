import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { AUTH_ON } from "./supabase/env";
import { supabaseServer } from "./supabase/server";

/**
 * Stateless in-season pass: a week pass (7 days) or a season pass (through SEASON_END).
 *  - cookie `cv_pass` = base64url(email|expiryMs).signature
 *  - license key = first 12 chars of HMAC(email) (lets a buyer unlock on another device)
 * Set CV_SECRET in production.
 */
const SECRET = process.env.CV_SECRET ?? (process.env.VERCEL_ENV === "production" ? "" : "dev-secret-change-me");
// Without a real secret anyone could forge a pass, so production refuses to sign or accept one.
if (!SECRET) console.error("[auth] CV_SECRET is not set; season passes are disabled.");
export const PASS_COOKIE = "cv_pass";
export const SEASON_END = Date.parse(process.env.CV_PASS_EXPIRES ?? "2027-07-01T00:00:00Z");
export const FREE_LIMIT = Number(process.env.CV_FREE_LIMIT ?? 50);
/**
 * The in-season paywall only applies once the Stripe links are set up (STRIPE_WEEK_LINK and
 * STRIPE_SEASON_LINK) or it is forced with CV_PAYWALL=on. The draft kit is always free.
 */
export const PAYWALL_ON = !!process.env.STRIPE_SEASON_LINK || process.env.CV_PAYWALL === "on";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** The two Stripe Payment Links, with each one's checkout prefilled with the buyer's email. */
export function planLinks(email?: string) {
  const link = (url: string | undefined) => (url ? url + (email ? `?prefilled_email=${encodeURIComponent(email)}` : "") : null);
  return { week: link(process.env.STRIPE_WEEK_LINK), season: link(process.env.STRIPE_SEASON_LINK) };
}

/**
 * When a paid checkout's access ends: 7 days after a week pass, the end of the season for a
 * season pass (and the old draft pass), null for anything else on the Stripe account.
 */
export function accessEnd(session: { payment_link?: string | null; created?: number }): number | null {
  const link = session.payment_link;
  if (!link) return null;
  if (link === process.env.STRIPE_WEEK_LINK_ID) return (session.created ?? 0) * 1000 + WEEK_MS;
  if (link === process.env.STRIPE_SEASON_LINK_ID || link === process.env.STRIPE_PAYMENT_LINK_ID) return SEASON_END;
  return null;
}

const sign = (s: string) => {
  if (!SECRET) throw new Error("CV_SECRET is not set");
  return createHmac("sha256", SECRET).update(s).digest("base64url");
};

export function licenseKey(email: string) {
  const h = sign(`key:${email.trim().toLowerCase()}`).replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12);
  return `${h.slice(0, 4)}-${h.slice(4, 8)}-${h.slice(8, 12)}`;
}

export function checkLicense(email: string, key: string) {
  const a = Buffer.from(licenseKey(email)), b = Buffer.from(key.trim().toUpperCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

export function makePass(email: string, until = SEASON_END) {
  const body = Buffer.from(`${email.trim().toLowerCase()}|${until}`).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readPass(value: string | undefined): { email: string; until: number } | null {
  if (!value || !SECRET) return null;
  const [body, sig] = value.split(".");
  if (!body || !sig) return null;
  const good = Buffer.from(sign(body)), got = Buffer.from(sig);
  if (good.length !== got.length || !timingSafeEqual(good, got)) return null;
  // The expiry is after the last "|": an email can contain "|", and a bad expiry must never mean "no expiry".
  const text = Buffer.from(body, "base64url").toString();
  const cut = text.lastIndexOf("|");
  const email = text.slice(0, cut), until = Number(text.slice(cut + 1));
  if (cut <= 0 || !email || !Number.isFinite(until) || until < Date.now()) return null;
  return { email, until };
}

/** Emails that get Pro for free when they sign in (FRIEND_EMAILS, comma-separated). */
const friendEmails = () => new Set((process.env.FRIEND_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));

const paidCache = new Map<string, { until: number; at: number }>();
const PAID_CACHE_MAX = 5000;
/**
 * Until when this email has access from its Stripe purchases (0 if none). An active pass is
 * cached for an hour (never past its end), none for 10 minutes, and a Stripe error for a minute
 * (so an outage doesn't turn every request into a Stripe call).
 */
async function paidUntilOnStripe(email: string): Promise<number> {
  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) return 0;
  const now = Date.now();
  const hit = paidCache.get(email);
  const active = !!hit && hit.until > now;
  const ttl = active ? 60 * 60 * 1000 : 10 * 60 * 1000;
  if (hit && now - hit.at < ttl) return hit.until > now ? hit.until : 0;
  const remember = (until: number, at = Date.now()) => {
    if (paidCache.size >= PAID_CACHE_MAX) paidCache.delete(paidCache.keys().next().value!);
    paidCache.set(email, { until, at });
    return until > Date.now() ? until : 0;
  };
  try {
    const q = new URLSearchParams({ "customer_details[email]": email, status: "complete", limit: "100" });
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions?${q}`, { headers: { Authorization: `Bearer ${sk}` }, cache: "no-store" });
    // On an error, keep what we knew; retry in about a minute.
    if (!r.ok) return remember(hit?.until ?? 0, now - ttl + 60 * 1000);
    const j = (await r.json()) as { data?: { payment_status?: string; payment_link?: string | null; created?: number }[] };
    const ends = (j.data ?? []).filter((s) => s.payment_status === "paid").map((s) => accessEnd(s) ?? 0);
    return remember(Math.max(0, ...ends));
  } catch { return remember(hit?.until ?? 0, now - ttl + 60 * 1000); }
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

type Pass = { email: string; via: "pass" | "friend" | "stripe"; until?: number };

/**
 * In-season access, from any of: the pass cookie (paid or comp code), a signed-in friend on
 * FRIEND_EMAILS, or a signed-in account whose email bought a pass on Stripe.
 */
export async function currentPass(): Promise<Pass | null> {
  const jar = await cookies();
  const pass = readPass(jar.get(PASS_COOKIE)?.value);
  if (pass) return { ...pass, via: "pass" };
  const account = await currentAccount();
  if (!account) return null;
  return accessFor(account.email);
}

/** Access for an email without a browser (crons, Telegram): a friend, or a pass bought on Stripe. */
export async function accessFor(email: string): Promise<Pass | null> {
  const e = email.toLowerCase();
  if (friendEmails().has(e)) return { email: e, via: "friend" };
  const until = await paidUntilOnStripe(e);
  return until ? { email: e, via: "stripe", until } : null;
}

export const passCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

/** The league owner (OWNER_EMAILS): the in-season tools read the owner's league with the server's ESPN login. */
export async function isOwner(): Promise<boolean> {
  const owners = new Set((process.env.OWNER_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
  const account = await currentAccount();
  return !!account && owners.has(account.email);
}
