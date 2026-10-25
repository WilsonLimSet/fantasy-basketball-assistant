import { kvStore } from "./inseason/storage";
import { FUNNEL_STEPS, type FunnelStep } from "./funnelSteps";

export { FUNNEL_STEPS, isFunnelStep, sourceOf, type FunnelStep } from "./funnelSteps";

interface Hit { step: FunnelStep; date: string; vid: string; src: string; country: string }

const PREFIX = "funnel:";
const day = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);

export async function recordFunnel(step: FunnelStep, vid: string, src = "", country = ""): Promise<void> {
  const date = day();
  const hit: Hit = { step, date, vid: vid.slice(0, 40), src: src.slice(0, 40), country: country.slice(0, 2) };
  await kvStore().claim(`${PREFIX}${date}:${step}:${hit.vid}`, hit);
}

export interface FunnelReport {
  days: number;
  steps: { step: FunnelStep; visitors: number }[];
  sources: { src: string; visitors: number; connected: number; paid: number }[];
  countries: { country: string; visitors: number }[];
  daily: { date: string; counts: Record<FunnelStep, number> }[];
}

/** Unique visitors per step over the last `days` days. */
export async function funnelReport(days = 14): Promise<FunnelReport> {
  const since = day(Date.now() - (days - 1) * 86_400_000);
  const hits = (await kvStore().list<Hit>(PREFIX)).filter((h) => h.date >= since);
  const uniq = (list: Hit[]) => new Set(list.map((h) => h.vid)).size;
  const byStep = (step: FunnelStep, list = hits) => list.filter((h) => h.step === step);
  // A visitor's source is the one their first visit came with.
  const srcOf = new Map<string, string>();
  for (const h of [...hits].sort((a, b) => a.date.localeCompare(b.date))) if (h.src && !srcOf.has(h.vid)) srcOf.set(h.vid, h.src);
  const sources = [...new Set(byStep("visit").map((h) => srcOf.get(h.vid) ?? "direct"))].map((src) => {
    const vids = (step: FunnelStep) => new Set(byStep(step).filter((h) => (srcOf.get(h.vid) ?? "direct") === src).map((h) => h.vid)).size;
    return { src, visitors: vids("visit"), connected: vids("league_connected"), paid: vids("purchase") };
  }).sort((a, b) => b.visitors - a.visitors);
  const countryCount = new Map<string, Set<string>>();
  for (const h of byStep("visit")) countryCount.set(h.country || "??", (countryCount.get(h.country || "??") ?? new Set()).add(h.vid));
  const dates = [...new Set(hits.map((h) => h.date))].sort().reverse();
  return {
    days,
    steps: FUNNEL_STEPS.map((step) => ({ step, visitors: uniq(byStep(step)) })),
    sources,
    countries: [...countryCount].map(([country, v]) => ({ country, visitors: v.size })).sort((a, b) => b.visitors - a.visitors),
    daily: dates.map((date) => ({ date, counts: Object.fromEntries(FUNNEL_STEPS.map((s) => [s, uniq(byStep(s, hits.filter((h) => h.date === date)))])) as Record<FunnelStep, number> })),
  };
}
