/**
 * Our own sales funnel (Vercel's custom events need the Pro plan): visit → league found → league
 * connected → free move seen → checkout click → purchase. Each visitor counts once per step per day:
 * the key is claimed atomically, so repeats and double-fires don't inflate it.
 */
export const FUNNEL_STEPS = ["visit", "league_found", "league_connected", "preview_seen", "checkout_click", "purchase"] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];
export const isFunnelStep = (s: unknown): s is FunnelStep => FUNNEL_STEPS.includes(s as FunnelStep);

/** Where a visit came from: the referrer's site, or utm_source when a link carries one. */
export function sourceOf(referrer: string, utm: string | null): string {
  if (utm) return utm.toLowerCase();
  try {
    const host = new URL(referrer).hostname.replace(/^(www|l|m|lm)\./, "");
    if (/threads\.(net|com)/.test(host)) return "threads";
    if (/(^|\.)x\.com$|t\.co$|twitter\.com/.test(host)) return "x";
    if (/instagram\.com/.test(host)) return "instagram";
    if (/facebook\.com/.test(host)) return "facebook";
    if (/google\./.test(host)) return "google";
    if (/takeoverfantasy\.com/.test(host)) return "";
    return host;
  } catch {
    return "direct";
  }
}
