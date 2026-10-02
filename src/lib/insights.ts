import { Cat, League, Valued, edgeTags, fantasyPoints } from "./engine";
import { fillLineup, teamForPick } from "./draft";

export interface Insight { tone: "good" | "bad" | "info"; text: string }

const espnRank = (v: Valued, league: League) =>
  (league.format === "cats" ? v.p.espnRankRoto ?? v.p.espnRank : v.p.espnRank ?? v.p.espnRankRoto) ?? null;
const round = (pick: number, teams: number) => Math.max(1, Math.ceil(pick / teams));
const CAT_LABEL: Record<Cat, string> = {
  pts: "points", reb: "rebounds", ast: "assists", stl: "steals", blk: "blocks", tpm: "threes", tov: "turnovers",
  "fg%": "FG%", "ft%": "FT%", dd: "double-doubles", oreb: "offensive boards",
};

/** Plain-language reasons behind a player's rank in this league. */
export function playerInsights(v: Valued, league: League): Insight[] {
  const out: Insight[] = [];
  const { p } = v;
  const ours = v.proj.line;
  const er = espnRank(v, league);

  if (er != null) {
    const d = er - v.rank;
    if (d >= 5) out.push({ tone: "good", text: `We rank him #${v.rank}, ${d} spots ahead of ESPN (#${er}).` });
    else if (d <= -5) out.push({ tone: "bad", text: `We rank him #${v.rank}, ${-d} spots behind ESPN (#${er}).` });
    else out.push({ tone: "info", text: `We agree with ESPN's rank (#${er} there, #${v.rank} here).` });
  }

  if (p.adp != null) {
    const gap = p.adp - v.rank;
    const r = round(p.adp, league.teams);
    if (gap >= 8) out.push({ tone: "good", text: `Market discount: he usually goes around pick ${p.adp.toFixed(0)} (round ${r}), later than his value here.` });
    else if (gap <= -8) out.push({ tone: "bad", text: `Market premium: drafters take him around pick ${p.adp.toFixed(0)} (round ${r}), earlier than we would.` });
  }

  if (league.format === "points" && p.proj) {
    const espnFp = fantasyPoints(p.proj, league.scoring);
    const diff = v.fppg - espnFp;
    if (Math.abs(diff) >= 1.5) {
      out.push({
        tone: diff > 0 ? "good" : "bad",
        text: `Per game we project ${v.fppg.toFixed(1)} fantasy points in your scoring, ${Math.abs(diff).toFixed(1)} ${diff > 0 ? "more" : "fewer"} than ESPN's line implies.`,
      });
    }
  }

  if (p.proj && Math.abs(v.proj.games - p.proj.gp) >= 5) {
    const fewer = v.proj.games < p.proj.gp;
    out.push({
      tone: fewer ? "bad" : "good",
      text: `We expect ${v.proj.games.toFixed(0)} games, ESPN projects ${p.proj.gp.toFixed(0)}${p.last ? ` (he played ${p.last.gp.toFixed(0)} last season)` : ""}.`,
    });
  }

  if (p.last && p.last.gp >= 20) {
    const dPts = ours.pts - p.last.pts, dMin = ours.min - p.last.min;
    if (dPts >= 2) out.push({ tone: "good", text: `Scoring projected up ${dPts.toFixed(1)} a game from last season (${p.last.pts.toFixed(1)} → ${ours.pts.toFixed(1)}).` });
    else if (dPts <= -2) out.push({ tone: "bad", text: `Scoring projected down ${(-dPts).toFixed(1)} a game from last season (${p.last.pts.toFixed(1)} → ${ours.pts.toFixed(1)}).` });
    if (p.last.min && Math.abs(dMin) >= 2.5) out.push({ tone: dMin > 0 ? "good" : "bad", text: `Minutes ${dMin > 0 ? "up" : "down"} to about ${ours.min.toFixed(0)} a night (from ${p.last.min.toFixed(0)}).` });
  } else if (!p.last) {
    out.push({ tone: "info", text: "No NBA track record last season, so this leans on the preseason projection and reports." });
  }

  if (league.format === "cats") {
    const cats = league.cats.filter((c) => !league.punts.includes(c));
    const sorted = cats.map((c) => ({ c, z: v.z[c] ?? 0 })).sort((a, b) => b.z - a.z);
    const strong = sorted.filter((x) => x.z >= 1).slice(0, 3);
    const weak = sorted.filter((x) => x.z <= -1).slice(-2);
    if (strong.length) out.push({ tone: "good", text: `Wins you ${strong.map((x) => CAT_LABEL[x.c]).join(", ")}.` });
    if (weak.length) out.push({ tone: "bad", text: `Hurts in ${weak.map((x) => CAT_LABEL[x.c]).join(" and ")}.` });
  } else {
    const tags = edgeTags(ours);
    if (tags.length) out.push({ tone: "info", text: `Profile: ${tags.join(", ").toLowerCase()}.` });
  }

  if (p.age != null && p.age > 32) out.push({ tone: "bad", text: `Age ${p.age}: we trim his games for the extra rest and injury risk.` });
  if (p.last && p.last.gp < 15 && p.proj) out.push({ tone: "info", text: `Only ${p.last.gp.toFixed(0)} games last season, so the per-game line leans on ESPN's projection.` });
  if (p.team === "FA" && !p.proj) out.push({ tone: "bad", text: "Unsigned and without an ESPN projection, so his games are heavily discounted." });
  if (p.injury && p.injury !== "ACTIVE") out.push({ tone: "bad", text: `Currently listed ${p.injury.replace(/_/g, " ").toLowerCase()}.` });
  return out;
}

/* ---------------- Mock draft review ---------------- */

export interface PickReview { k: number; v: Valued; delta: number; label: "Steal" | "Value" | "Fair" | "Reach" }
export interface TeamReview {
  t: number; score: number; place: number; grade: string; fppg: number;
  /** Average projected games of the starters. */
  games: number;
  best: Valued | null;
}
export interface DraftReview {
  teams: TeamReview[];
  mine: TeamReview;
  myPicks: PickReview[];
  bestPick: PickReview | null;
  worstPick: PickReview | null;
  leagueSteal: (PickReview & { t: number }) | null;
  strengths: string[];
  weaknesses: string[];
  openSlots: string[];
}

const gradeOf = (pct: number) => (pct >= 0.9 ? "A" : pct >= 0.7 ? "B+" : pct >= 0.5 ? "B" : pct >= 0.3 ? "C" : "D");

function teamScore(roster: Valued[], league: League) {
  const { filled, bench } = fillLineup(roster, league);
  const starters = filled.reduce((s, f) => s + (f.v?.vorp ?? 0), 0);
  return starters + 0.35 * bench.reduce((s, v) => s + Math.max(v.vorp, 0), 0);
}

function reviewPick(k: number, v: Valued): PickReview {
  const delta = k + 1 - v.rank; // positive: taken later than our rank, so value
  const label = delta >= 12 ? "Steal" : delta >= 5 ? "Value" : delta <= -10 ? "Reach" : "Fair";
  return { k, v, delta, label };
}

/** Grades every team and explains where your draft was strong or weak. */
export function reviewDraft(picks: number[], byId: Map<number, Valued>, league: League, me: number): DraftReview {
  const n = league.teams;
  const rosters: Valued[][] = Array.from({ length: n }, () => []);
  const all: (PickReview & { t: number })[] = [];
  picks.forEach((id, k) => {
    const v = byId.get(id);
    if (!v) return;
    const t = teamForPick(k, n);
    rosters[t].push(v);
    all.push({ ...reviewPick(k, v), t });
  });

  const starterFp = (r: Valued[]) => fillLineup(r, league).filled.reduce((s, f) => s + (f.v?.fppg ?? 0), 0);
  const starterGames = (r: Valued[]) => {
    const s = fillLineup(r, league).filled.filter((f) => f.v);
    return s.length ? s.reduce((a, f) => a + f.v!.proj.games, 0) / s.length : 0;
  };
  const ranked = rosters.map((r, t) => ({ t, score: teamScore(r, league) })).sort((a, b) => b.score - a.score);
  const teams: TeamReview[] = ranked.map((x, i) => ({
    ...x,
    place: i + 1,
    grade: gradeOf(1 - i / Math.max(1, n - 1)),
    fppg: starterFp(rosters[x.t]),
    games: starterGames(rosters[x.t]),
    best: [...rosters[x.t]].sort((a, b) => b.vorp - a.vorp)[0] ?? null,
  }));
  const mine = teams.find((x) => x.t === me)!;

  const myPicks = all.filter((x) => x.t === me);
  const byDelta = [...myPicks].sort((a, b) => b.delta - a.delta);
  const bestPick = byDelta[0] && byDelta[0].delta > 0 ? byDelta[0] : null;
  const worst = byDelta[byDelta.length - 1];
  const worstPick = worst && worst.delta < 0 ? worst : null;
  const leagueSteal = [...all].filter((x) => x.v.rank <= picks.length).sort((a, b) => b.delta - a.delta)[0] ?? null;

  const strengths: string[] = [], weaknesses: string[] = [];
  if (league.format === "cats") {
    const cats = league.cats.filter((c) => !league.punts.includes(c));
    for (const c of cats) {
      const sums = rosters.map((r) => r.reduce((s, v) => s + (v.z[c] ?? 0), 0));
      const place = sums.filter((s) => s > sums[me]).length + 1;
      if (place <= Math.max(2, Math.round(n * 0.25))) strengths.push(`${CAT_LABEL[c]} (#${place})`);
      else if (place > n - Math.max(2, Math.round(n * 0.25))) weaknesses.push(`${CAT_LABEL[c]} (#${place})`);
    }
  } else {
    const keys = ["pts", "reb", "ast", "stl", "blk", "tpm"] as const;
    const label: Record<(typeof keys)[number], string> = { pts: "scoring", reb: "rebounding", ast: "playmaking", stl: "steals", blk: "blocks", tpm: "threes" };
    for (const k of keys) {
      const sums = rosters.map((r) => r.reduce((s, v) => s + v.proj.line[k], 0));
      const place = sums.filter((s) => s > sums[me]).length + 1;
      if (place <= 2) strengths.push(`${label[k]} (#${place})`);
      else if (place >= n - 1) weaknesses.push(`${label[k]} (#${place})`);
    }
  }
  const openSlots = fillLineup(rosters[me], league).filled.filter((f) => !f.v).map((f) => (f.slot === "UT" ? "UTIL" : f.slot));

  return { teams, mine, myPicks, bestPick, worstPick, leagueSteal, strengths, weaknesses, openSlots };
}
