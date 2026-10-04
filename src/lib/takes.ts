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

export const TAKES: Take[] = (takesFile as { takes: Take[] }).takes;
export const TAKES_UPDATED: string = (takesFile as { updatedAt: string }).updatedAt;

export const normName = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[.'’-]/g, "").replace(/\b(jr|sr|ii|iii|iv)\b/g, "").replace(/\s+/g, " ").trim();

const INDEX = new Map(TAKES.map((t) => [t.key, t]));
export const findTake = (name: string) => INDEX.get(normName(name));

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
