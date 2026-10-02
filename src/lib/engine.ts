import { Player, Pos, StatKey, StatLine, STAT_KEYS } from "./types";
import { Take, applyMult, findTake, hasRoleChange, takeLine } from "./takes";

/* ---------------- League settings ---------------- */

export type PointsScoring = Partial<Record<StatKey, number>>;
export type Cat = "pts" | "reb" | "ast" | "stl" | "blk" | "tpm" | "tov" | "fg%" | "ft%" | "dd" | "oreb";
export type Slot = Pos | "G" | "F" | "UT";

export interface League {
  presetId: string;
  format: "points" | "cats";
  scoring: PointsScoring; // points leagues
  cats: Cat[]; // category leagues
  punts: Cat[];
  teams: number;
  slots: Record<Slot, number>; // starting lineup slots
  bench: number;
}

export const ESPN_SLOTS: Record<Slot, number> = { PG: 1, SG: 1, SF: 1, PF: 1, C: 1, G: 1, F: 1, UT: 3 };
export const YAHOO_SLOTS: Record<Slot, number> = { PG: 1, SG: 1, SF: 1, PF: 1, C: 2, G: 1, F: 1, UT: 2 };

export const NINE_CAT: Cat[] = ["fg%", "ft%", "tpm", "pts", "reb", "ast", "stl", "blk", "tov"];

export const PRESETS: { id: string; label: string; league: Omit<League, "teams" | "punts"> }[] = [
  {
    id: "espn-points",
    label: "ESPN Points (default)",
    league: {
      presetId: "espn-points",
      format: "points",
      // ESPN default H2H points scoring
      scoring: { pts: 1, tpm: 1, fga: -1, fgm: 2, fta: -1, ftm: 1, reb: 1, ast: 2, stl: 4, blk: 4, tov: -2 },
      cats: NINE_CAT,
      slots: ESPN_SLOTS,
      bench: 3,
    },
  },
  {
    id: "yahoo-points",
    label: "Yahoo Points (default)",
    league: {
      presetId: "yahoo-points",
      format: "points",
      scoring: { pts: 1, reb: 1.2, ast: 1.5, stl: 3, blk: 3, tov: -1 },
      cats: NINE_CAT,
      slots: YAHOO_SLOTS,
      bench: 3,
    },
  },
  {
    id: "espn-9cat",
    label: "ESPN 9-Cat",
    league: { presetId: "espn-9cat", format: "cats", scoring: {}, cats: NINE_CAT, slots: ESPN_SLOTS, bench: 3 },
  },
  {
    id: "yahoo-9cat",
    label: "Yahoo 9-Cat",
    league: { presetId: "yahoo-9cat", format: "cats", scoring: {}, cats: NINE_CAT, slots: YAHOO_SLOTS, bench: 3 },
  },
  {
    id: "8cat",
    label: "8-Cat (no TO)",
    league: {
      presetId: "8cat",
      format: "cats",
      scoring: {},
      cats: NINE_CAT.filter((c) => c !== "tov"),
      slots: ESPN_SLOTS,
      bench: 3,
    },
  },
];

export function leagueFromPreset(id: string, teams = 10): League {
  const p = PRESETS.find((x) => x.id === id) ?? PRESETS[0];
  return { ...structuredClone(p.league), teams, punts: [] };
}

export const rosterSize = (l: League) =>
  Object.values(l.slots).reduce((a, b) => a + b, 0) + l.bench;

/* ---------------- Projection model ---------------- */

export interface Projection {
  line: StatLine; // per game
  games: number;
  basis: string;
}

/**
 * Our projection: blend ESPN's preseason projection with last season's
 * actual production (regressed), then apply a durability-aware games estimate.
 * In-season, current stats get blended in proportionally to games played.
 */
export function project(p: Player, take?: Take | null): Projection | null {
  const { proj, cur } = p;
  let { last } = p;
  const rookieLine = take ? takeLine(take) : null;
  // Our role-adjusted view of last season (or the rookie projection from the take).
  const ours: StatLine | null = rookieLine ?? (take && last && hasRoleChange(take) ? applyMult(last, take) : null);
  if (ours && !rookieLine) last = ours;
  if (!proj && !last && !cur && !rookieLine) return null;

  const line = {} as StatLine;
  let basis: string;
  let wProj = 0, wLast = 0, wCur = 0;
  const lastGp = p.last?.gp ?? 0;
  const src = rookieLine ?? last;
  if (rookieLine) {
    wProj = proj ? 0.5 : 0; wLast = proj ? 0.5 : 1; basis = "take+espn";
  } else if (proj && last && (lastGp >= 15 || ours)) {
    // With an analyst take, our adjusted line gets equal weight with ESPN's projection.
    wProj = ours ? 0.5 : 0.6; wLast = ours ? 0.5 : 0.4; basis = ours ? "take-blend" : "blend";
  } else if (proj) {
    wProj = 1; basis = "espn-proj";
  } else {
    wLast = 1; basis = ours ? "take" : "last-season";
  }
  if (cur && cur.gp > 0) {
    // weight current season more as sample grows (full trust ~40 games)
    wCur = Math.min(0.85, cur.gp / 40);
    wProj *= 1 - wCur; wLast *= 1 - wCur;
    basis += "+current";
  }
  for (const k of STAT_KEYS) {
    line[k] = (proj?.[k] ?? 0) * wProj + (src?.[k] ?? 0) * wLast + (cur?.[k] ?? 0) * wCur;
  }
  // Games: ESPN projections tend to be optimistic for injury-prone players.
  let games: number;
  if (take?.games != null) games = take.games;
  else if (proj && lastGp > 0) games = 0.55 * proj.gp + 0.45 * Math.min(lastGp, 82);
  else if (proj) games = proj.gp * 0.95;
  else games = Math.min(lastGp, 78) * 0.95;
  games = Math.max(0, Math.min(games, 79));
  if (p.injury === "OUT" && take?.games == null) games *= 0.85;
  line.gp = games;
  return { line, games, basis };
}

/* ---------------- Valuation ---------------- */

export function fantasyPoints(line: StatLine, scoring: PointsScoring) {
  let s = 0;
  for (const [k, w] of Object.entries(scoring)) s += (line[k as StatKey] ?? 0) * (w ?? 0);
  return s;
}

export interface Valued {
  p: Player;
  proj: Projection;
  fppg: number; // points leagues
  total: number; // value used for ranking before replacement level
  z: Partial<Record<Cat, number>>; // cats leagues, per-cat z
  vorp: number;
  rank: number;
  posRank: Record<string, number>;
  tier: number;
  take: Take | null;
}

const catRaw = (l: StatLine, c: Cat): number => {
  switch (c) {
    case "fg%": return l.fga ? l.fgm / l.fga : 0;
    case "ft%": return l.fta ? l.ftm / l.fta : 0;
    default: return l[c as StatKey] ?? 0;
  }
};

function mean(a: number[]) { return a.reduce((x, y) => x + y, 0) / (a.length || 1); }
function sd(a: number[]) {
  const m = mean(a);
  return Math.sqrt(mean(a.map((x) => (x - m) ** 2))) || 1;
}

function catZScores(pool: { line: StatLine }[], all: { line: StatLine }[], cats: Cat[]) {
  const res = all.map(() => ({} as Partial<Record<Cat, number>>));
  for (const c of cats) {
    let vals: number[]; let poolVals: number[];
    if (c === "fg%" || c === "ft%") {
      // impact = attempts * (pct - league pct); volume matters
      const [m, a] = c === "fg%" ? ["fgm", "fga"] as const : ["ftm", "fta"] as const;
      const lgPct = pool.reduce((s, x) => s + x.line[m], 0) / (pool.reduce((s, x) => s + x.line[a], 0) || 1);
      const imp = (l: StatLine) => l[m] - lgPct * l[a];
      vals = all.map((x) => imp(x.line));
      poolVals = pool.map((x) => imp(x.line));
    } else {
      vals = all.map((x) => catRaw(x.line, c));
      poolVals = pool.map((x) => catRaw(x.line, c));
    }
    const m = mean(poolVals), s = sd(poolVals);
    const sign = c === "tov" ? -1 : 1;
    vals.forEach((v, i) => (res[i][c] = (sign * (v - m)) / s));
  }
  return res;
}

const SLOT_ELIG: Record<Slot, Pos[]> = {
  PG: ["PG"], SG: ["SG"], SF: ["SF"], PF: ["PF"], C: ["C"],
  G: ["PG", "SG"], F: ["SF", "PF"], UT: ["PG", "SG", "SF", "PF", "C"],
};

/** Value every player under a league's settings and rank by value over replacement. */
export function valuePlayers(players: Player[], league: League, useTakes = true): Valued[] {
  const takeOf = new Map<number, Take>();
  if (useTakes) for (const p of players) { const t = findTake(p.name); if (t) takeOf.set(p.id, t); }
  const base = players
    .map((p) => ({ p, proj: project(p, takeOf.get(p.id)) }))
    .filter((x): x is { p: Player; proj: Projection } => !!x.proj && x.proj.games > 0);

  const draftable = league.teams * rosterSize(league);
  let scored: { p: Player; proj: Projection; fppg: number; total: number; z: Partial<Record<Cat, number>> }[];

  if (league.format === "points") {
    scored = base.map(({ p, proj }) => {
      const fppg = fantasyPoints(proj.line, league.scoring);
      return { p, proj, fppg, total: fppg * proj.games, z: {} };
    });
  } else {
    const cats = league.cats.filter((c) => !league.punts.includes(c));
    const lines = base.map((b) => ({ line: b.proj.line }));
    // two-pass: rough pool from pts+reb+ast, then refine pool by z-sum
    let order = base.map((b, i) => ({ i, v: b.proj.line.pts + b.proj.line.reb + b.proj.line.ast + 2 * (b.proj.line.stl + b.proj.line.blk) }));
    let zs = catZScores(order.sort((a, b) => b.v - a.v).slice(0, draftable).map((o) => lines[o.i]), lines, cats);
    for (let pass = 0; pass < 2; pass++) {
      order = zs.map((z, i) => ({ i, v: Object.values(z).reduce((a, b) => a + (b ?? 0), 0) }));
      zs = catZScores(order.sort((a, b) => b.v - a.v).slice(0, draftable).map((o) => lines[o.i]), lines, cats);
    }
    scored = base.map(({ p, proj }, i) => {
      const zsum = Object.values(zs[i]).reduce((a, b) => a + (b ?? 0), 0);
      // availability: H2H cats reward playing; scale by games relative to 70
      const avail = Math.min(1.1, proj.games / 70);
      const total = zsum >= 0 ? zsum * avail : zsum / Math.max(avail, 0.5);
      return { p, proj, fppg: 0, total, z: zs[i] };
    });
  }

  // Replacement level via greedy league-wide lineup fill.
  scored.sort((a, b) => b.total - a.total);
  const slotsLeft: Record<string, number> = {};
  for (const [s, n] of Object.entries(league.slots)) slotsLeft[s] = n * league.teams;
  const order: Slot[] = ["C", "PG", "SG", "SF", "PF", "G", "F", "UT"];
  const starters = new Set<number>();
  for (const x of scored) {
    const slot = order.find((s) => slotsLeft[s] > 0 && SLOT_ELIG[s].some((pp) => x.p.pos.includes(pp)));
    if (slot) { slotsLeft[slot]--; starters.add(x.p.id); }
    if (Object.values(slotsLeft).every((n) => n <= 0)) break;
  }
  const benchPool = scored.filter((x) => !starters.has(x.p.id));
  const repl: Record<Pos, number> = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
  // replacement = best player at each position beyond starters + bench depth
  const benchDepth = league.teams * league.bench;
  for (const pos of Object.keys(repl) as Pos[]) {
    const atPos = benchPool.filter((x) => x.p.pos.includes(pos));
    const idx = Math.min(atPos.length - 1, Math.round(benchDepth / 5));
    repl[pos] = atPos[Math.max(idx, 0)]?.total ?? 0;
  }

  const valued: Valued[] = scored.map((x) => {
    const r = x.p.pos.length ? Math.min(...x.p.pos.map((pp) => repl[pp])) : Math.max(...Object.values(repl));
    return { ...x, vorp: x.total - r, rank: 0, posRank: {}, tier: 0, take: takeOf.get(x.p.id) ?? null };
  });
  valued.sort((a, b) => b.vorp - a.vorp);
  const posCount: Record<string, number> = {};
  valued.forEach((v, i) => {
    v.rank = i + 1;
    for (const pp of v.p.pos) v.posRank[pp] = posCount[pp] = (posCount[pp] ?? 0) + 1;
  });
  assignTiers(valued);
  return valued;
}

/** Tier breaks where the value gap is unusually large relative to local spread. */
function assignTiers(v: Valued[]) {
  if (!v.length) return;
  const top = v.slice(0, 200);
  const gaps = top.slice(1).map((x, i) => top[i].vorp - x.vorp);
  const sorted = [...gaps].sort((a, b) => a - b);
  const thresh = sorted[Math.floor(sorted.length * 0.85)] ?? 0;
  let tier = 1;
  let lastBreak = 0;
  v.forEach((x, i) => {
    if (i > 0 && i < top.length && gaps[i - 1] >= thresh && i - lastBreak >= 4) {
      tier++;
      lastBreak = i;
    }
    x.tier = i >= top.length ? tier + 1 : tier;
  });
}

/* ---------------- Explanations ---------------- */

export function edgeTags(line: StatLine): string[] {
  const tags: string[] = [];
  const missFG = line.fga - line.fgm, missFT = line.fta - line.ftm;
  if (line.stl + line.blk >= 2.5) tags.push("Stocks monster");
  if (line.tpm >= 2.8) tags.push("3PT volume");
  if (line.fga >= 12 && line.fga && line.fgm / line.fga < 0.44) tags.push("Inefficient FG");
  if (line.fta >= 4 && line.ftm / line.fta < 0.7) tags.push("FT% drag");
  if (missFG + missFT >= 11) tags.push("Lots of misses");
  if (line.tov >= 3.2) tags.push("Turnover-heavy");
  if (line.ast >= 7) tags.push("Assist engine");
  if (line.reb >= 10) tags.push("Glass cleaner");
  return tags;
}
