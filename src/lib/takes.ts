import takesFile from "@/data/takes.json";
import type { StatKey, StatLine } from "./types";
import { STAT_KEYS } from "./types";

export interface TakeNote {
  headline: string;
  text: string;
  source: string;
  date: string;
  confidence: "high" | "med" | "low";
}

export interface Take {
  key: string;
  name: string;
  team: string;
  kind: "injury" | "boost" | "fade" | "rookie" | "note";
  games: number | null;
  mult: Partial<Record<StatKey, number>>;
  line: Partial<Record<StatKey, number>> | null;
  headline: string;
  notes: TakeNote[];
  updated: string;
}

interface TakeSet { takes: Take[]; updatedAt: string; index: Map<string, Take> }

const makeSet = (takes: Take[], updatedAt: string): TakeSet => ({ takes, updatedAt, index: new Map(takes.map((t) => [t.key, t])) });

/** Takes bundled with the build: the fallback when the published copy can't be read. */
const BUNDLED = makeSet((takesFile as { takes: Take[] }).takes, (takesFile as { updatedAt: string }).updatedAt);
let current = BUNDLED;
let checkedAt = 0;
const RECHECK_MS = 5 * 60 * 1000;

/**
 * The latest takes. They're published to Vercel Blob (TAKES_URL) by `npm run takes:publish`, so a
 * news update goes live within ~5 minutes without a rebuild. Without TAKES_URL, or if the fetch
 * fails, the copy bundled at build time is used.
 */
export async function loadTakes(): Promise<TakeSet> {
  const url = process.env.TAKES_URL;
  if (!url || Date.now() - checkedAt < RECHECK_MS) return current;
  checkedAt = Date.now();
  try {
    // Our own 5-minute recheck is the cache; skip Next's data cache so a publish shows up promptly.
    const r = await fetch(url, { cache: "no-store" });
    if (r.ok) {
      const j = (await r.json()) as { takes?: Take[]; updatedAt?: string };
      if (Array.isArray(j.takes) && j.takes.length && typeof j.updatedAt === "string") current = makeSet(j.takes, j.updatedAt);
    }
  } catch { /* keep the last good copy */ }
  return current;
}

export const normName = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[.'’-]/g, "").replace(/\b(jr|sr|ii|iii|iv)\b/g, "").replace(/\s+/g, " ").trim();

/** The take for a player, from the latest loaded set (call loadTakes() first on the server). */
export const findTake = (name: string) => current.index.get(normName(name));

/** Effective multiplier per stat. Unspecified counting stats follow minutes. */
function m(take: Take, k: StatKey): number {
  const t = take.mult;
  const base = t.min ?? 1;
  switch (k) {
    case "fgm": return t.fgm ?? t.fga ?? t.pts ?? base;
    case "ftm": return t.ftm ?? t.fta ?? t.pts ?? base;
    case "tpa": return t.tpa ?? t.tpm ?? base;
    case "oreb": case "dreb": return t.reb ?? base;
    case "fga": return t.fga ?? t.pts ?? base;
    case "fta": return t.fta ?? t.pts ?? base;
    default: return t[k] ?? base;
  }
}

/** Apply a take's role multipliers to a baseline (last season) line. */
export function applyMult(line: StatLine, take: Take): StatLine {
  const out = { ...line };
  for (const k of STAT_KEYS) out[k] = line[k] * m(take, k);
  return out;
}

/** Build a full stat line from a take's rookie projection. */
export function takeLine(take: Take): StatLine | null {
  if (!take.line) return null;
  const out = { gp: take.games ?? 70 } as StatLine;
  for (const k of STAT_KEYS) out[k] = take.line[k] ?? 0;
  if (!out.tpa && out.tpm) out.tpa = out.tpm / 0.35;
  if (!out.oreb && !out.dreb && out.reb) { out.oreb = out.reb * 0.25; out.dreb = out.reb * 0.75; }
  return out;
}

export const hasRoleChange = (t: Take) => Object.values(t.mult).some((v) => Math.abs((v ?? 1) - 1) >= 0.01);
