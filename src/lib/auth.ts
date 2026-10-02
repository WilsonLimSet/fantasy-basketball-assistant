import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

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

export async function currentPass() {
  const jar = await cookies();
  return readPass(jar.get(PASS_COOKIE)?.value);
}

export const passCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  expires: new Date(SEASON_END),
};
