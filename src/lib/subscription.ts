import { isWeeklyCheckout, subscriptionState, type SubscriptionState } from "./auth";

/**
 * The weekly subscription, managed from our own page rather than Stripe's portal: cancel (at the
 * end of the paid week, after offering the season pass), resume, and stop it automatically when
 * the same person buys the season.
 */

const stripe = async (path: string, init?: { method: string; body: URLSearchParams }) => {
  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) throw new Error("STRIPE_SECRET_KEY is not set");
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${sk}`, ...(init ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: init?.body,
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Stripe ${path}: ${r.status}`);
  return r.json();
};

/** The weekly subscriptions bought with this email that still give access, newest first. */
export async function weeklySubscriptions(email: string): Promise<SubscriptionState[]> {
  const q = new URLSearchParams({ "customer_details[email]": email.toLowerCase(), status: "complete", limit: "100" });
  const j = (await stripe(`checkout/sessions?${q}`)) as { data?: { payment_link?: string; subscription?: string; created?: number }[] };
  const ids = [...new Set((j.data ?? []).filter(isWeeklyCheckout).sort((a, b) => (b.created ?? 0) - (a.created ?? 0)).map((s) => s.subscription!))];
  const subs = await Promise.all(ids.map(subscriptionState));
  return subs.filter((s) => s.until > Date.now());
}

/** Stop renewing (or start again): access lasts to the end of the week already paid for. */
export async function setRenewal(id: string, renew: boolean): Promise<SubscriptionState> {
  await stripe(`subscriptions/${encodeURIComponent(id)}`, { method: "POST", body: new URLSearchParams({ cancel_at_period_end: renew ? "false" : "true" }) });
  return subscriptionState(id);
}

/** After a season purchase: the weekly subscription has nothing left to give, so stop it renewing. */
export async function stopWeeklyFor(email: string): Promise<number> {
  const subs = (await weeklySubscriptions(email)).filter((s) => s.renews);
  await Promise.all(subs.map((s) => setRenewal(s.id, false)));
  return subs.length;
}
