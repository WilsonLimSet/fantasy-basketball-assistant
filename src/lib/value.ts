import { getPlayers } from "./data";
import { fantasyPoints, PRESETS } from "./engine";
import { injuryReport, type InjuryReportEntry } from "./inseason/stash";
import { kvStore } from "./inseason/storage";
import { easternDate, teamTips } from "./social";
import type { Player, StatKey, StatLine } from "./types";

/**
 * How Takeover values a player. Expected fantasy points = chance he plays × minutes × points per
 * minute, summed over the games that matter:
 *  - window: a stretch like "the next 2 days" or "rest of this week". Only whether he plays those
 *    games counts (current injury status), not long-term durability.
 *  - rest of season: durability counts too (games missed last season, age, current injury).
 * Minutes follow recent games (median of the last few, so one blowout doesn't swing it) and flag
 * roles that only exist while an injured teammate is out. Points per minute is split in two:
 * rebounds, assists, steals, blocks and turnovers settle fast, so this season's rate takes over
 * quickly; scoring and shooting swing with luck, so it leans on the projection longer and drives
 * the floor/ceiling spread. Players on bad teams get no penalty: empty stats still count.
 */

const SCORING = PRESETS[0].league.scoring;
/** The settled part of a stat line. */
const RELIABLE: StatKey[] = ["reb", "oreb", "dreb", "ast", "stl", "blk", "tov", "dd", "td"];
const OUT = new Set(["OUT", "INJURY_RESERVE", "SUSPENSION"]);
const DAY = 864e5;

export interface ValueContext {
  now: number;
  players: Player[];
  byId: Map<number, Player>;
  injuries: Map<number, InjuryReportEntry>;
  tips: Map<string, number[]>;
  /** Minutes in each recent game played, newest first (from the nightly box-score snapshots). */
  recentMin: Map<number, number[]>;
}

export async function valueContext(now = Date.now()): Promise<ValueContext> {
  const kv = kvStore();
  const nights = Array.from({ length: 10 }, (_, i) => easternDate(now - (i + 1) * DAY));
  const [{ players }, injuries, tips, snaps] = await Promise.all([
    getPlayers(),
    injuryReport().catch(() => new Map<number, InjuryReportEntry>()),
    teamTips().catch(() => new Map<string, number[]>()),
    Promise.all(nights.map((d) => kv.get<Record<string, number>>(`social:minutes:${d}`).catch(() => null))),
  ]);
  const recentMin = new Map<number, number[]>();
  for (const snap of snaps) for (const [id, min] of Object.entries(snap ?? {})) if (min > 0) recentMin.set(Number(id), [...(recentMin.get(Number(id)) ?? []), min]);
  return { now, players, byId: new Map(players.map((p) => [p.id, p])), injuries, tips, recentMin };
}

export interface PlayerValue {
  id: number;
  /** Expected fantasy points in a game he plays, now. */
  perGame: number;
  /** A bad night and a good night (about one standard deviation). */
  floor: number;
  ceiling: number;
  minutes: number;
  /** Share of his points from rebounds/assists/stocks (steadier than scoring). */
  steady: number;
  status: string;
  returnDate?: string;
  /** His minutes are up only while a teammate is out. */
  temporary?: { until: string; because: string; minutesAfter: number };
  /** In the window asked for: games, and expected points counting only current injury status. */
  games: number;
  window: number;
  /** Rest of season: expected points per team game left, durability included. */
  ros: number;
}

const blend = (cur: number, prior: number, w: number) => w * cur + (1 - w) * prior;
const part = (line: StatLine, keep: (k: StatKey) => boolean) =>
  Object.fromEntries(Object.entries(line).map(([k, v]) => [k, k === "gp" || keep(k as StatKey) ? v : 0])) as StatLine;
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const group = (p: Player) => (p.pos.includes("C") && !p.pos.includes("SF") ? "C" : p.pos.includes("PG") || p.pos.includes("SG") ? "G" : "F");

function statusOf(p: Player, ctx: ValueContext): { status: string; returnDate?: string } {
  const r = ctx.injuries.get(p.id);
  if (!r) return { status: OUT.has(p.injury) ? "OUT" : p.injury === "DAY_TO_DAY" ? "DAY_TO_DAY" : "ACTIVE" };
  const s = r.status.toLowerCase();
  return { status: s.includes("out") || s.includes("injured") ? "OUT" : s.includes("day") || s.includes("question") ? "DAY_TO_DAY" : "ACTIVE", returnDate: r.returnDate };
}

/** Chance he plays a game at time t, from his current status only. */
function playChance(t: number, st: { status: string; returnDate?: string }, first: boolean, now: number): number {
  if (st.status === "OUT") {
    if (!st.returnDate) return t - now < 7 * DAY ? 0 : 0.5;
    return easternDate(t) < st.returnDate ? 0 : 0.85;
  }
  if (st.status === "DAY_TO_DAY") return first ? 0.6 : 0.9;
  return 0.97;
}

const isRookie = (p: Player) => p.bio?.years === 0 || (p.bio?.years == null && !p.last && (p.age ?? 22) <= 22);

/**
 * Long-term durability: share of games he plays when not on a known injury. Last season's games
 * only count for players who were in the rotation (20+ minutes): a bench player's missed games are
 * mostly coach's decisions, not injuries. Kept in a narrow band, since one season is a noisy guide.
 */
function durability(p: Player): number {
  const rotation = (p.last?.gp ?? 0) > 0 && (p.last?.min ?? 0) >= 20;
  // No games last season: fine for a rookie, a risk for a veteran (usually a long injury).
  const lastRate = rotation ? Math.min(1, p.last!.gp / 72) : !p.last?.gp && !isRookie(p) && (p.bio?.years ?? 0) >= 2 ? 0.6 : 0.88;
  let d = 0.4 * lastRate + 0.6 * 0.88;
  if ((p.age ?? 0) >= 33) d -= 0.05;
  else if ((p.age ?? 0) >= 30) d -= 0.02;
  return Math.min(0.95, Math.max(0.7, d));
}

export function valuePlayer(p: Player, ctx: ValueContext, window?: { from: string; to: string }): PlayerValue {
  const st = statusOf(p, ctx);
  const prior = p.proj?.min ? p.proj : p.last?.min ? p.last : null;
  const cur = p.cur?.gp && p.cur.min ? p.cur : null;
  const gp = cur?.gp ?? 0;
  // A rookie's projection is a guess, so his own games take over faster.
  const [kMin, kRel, kScore] = isRookie(p) ? [1, 2, 5] : [3, 3, 10];

  // Minutes: recent games (median) and the season so far, then the prior until games pile up.
  const recent = (ctx.recentMin.get(p.id) ?? []).slice(0, 5);
  const now = cur ? (recent.length >= 2 ? 0.6 * median(recent) + 0.4 * cur.min : cur.min) : prior?.min ?? 0;
  const minutes = prior ? blend(now, prior.min, gp / (gp + kMin)) : now;

  // Points per minute, settled and volatile parts separately.
  const rate = (line: StatLine | null, keep: (k: StatKey) => boolean) => (line?.min ? fantasyPoints(part(line, keep), SCORING) / line.min : 0);
  const isRel = (k: StatKey) => RELIABLE.includes(k), isScore = (k: StatKey) => !RELIABLE.includes(k);
  const relPM = cur && prior ? blend(rate(cur, isRel), rate(prior, isRel), gp / (gp + kRel)) : rate(cur ?? prior, isRel);
  const scoPM = cur && prior ? blend(rate(cur, isScore), rate(prior, isScore), gp / (gp + kScore)) : rate(cur ?? prior, isScore);
  const relPts = minutes * relPM, scoPts = minutes * scoPM;
  const perGame = Math.max(0, relPts + scoPts);
  const sd = Math.sqrt((0.45 * Math.max(0, scoPts)) ** 2 + (0.25 * Math.max(0, relPts)) ** 2);

  // A role that exists only while a teammate is out: minutes well above his norm, and a regular
  // in his position group out with a return date.
  let temporary: PlayerValue["temporary"];
  const norm = p.last?.min ?? prior?.min ?? 0;
  if (norm && minutes - norm >= 4) {
    const absent = ctx.players
      .filter((q) => q.team === p.team && q.id !== p.id && group(q) === group(p) && (q.last?.min ?? q.proj?.min ?? 0) >= 24)
      .map((q) => ({ q, r: ctx.injuries.get(q.id) }))
      .filter((x) => x.r?.returnDate && /out/i.test(x.r.status) && Date.parse(x.r.returnDate) - ctx.now < 60 * DAY)
      .sort((a, b) => a.r!.returnDate!.localeCompare(b.r!.returnDate!));
    if (absent[0]) temporary = { until: absent[0].r!.returnDate!, because: absent[0].q.name, minutesAfter: Math.round((norm + (minutes - norm) / 2) * 10) / 10 };
  }
  const perGameAt = (t: number) => (temporary && easternDate(t) >= temporary.until ? perGame * (temporary.minutesAfter / minutes) : perGame);

  const tips = (ctx.tips.get(p.team) ?? []).filter((t) => t > ctx.now);
  const inWindow = window ? tips.filter((t) => easternDate(t) >= window.from && easternDate(t) <= window.to) : [];
  const windowPts = inWindow.reduce((s, t, i) => s + playChance(t, st, i === 0, ctx.now) * perGameAt(t), 0);
  const dur = durability(p);
  const rosPts = tips.reduce((s, t, i) => s + (st.status === "ACTIVE" ? dur : Math.min(dur, playChance(t, st, i === 0, ctx.now))) * perGameAt(t), 0);

  const r1 = (n: number) => Math.round(n * 10) / 10;
  return {
    id: p.id, perGame: r1(perGame), floor: r1(Math.max(0, perGame - sd)), ceiling: r1(perGame + sd), minutes: r1(minutes),
    steady: perGame ? Math.round((relPts / perGame) * 100) / 100 : 0, status: st.status, returnDate: st.returnDate, temporary,
    games: inWindow.length, window: r1(windowPts), ros: r1(tips.length ? rosPts / tips.length : 0),
  };
}

/* ---------------- Keeping score ---------------- */

type Pred = Record<string, [perGame: number, steady: number]>;
export interface PredictionScore { date: string; n: number; mae: number; bias: number; steady: { n: number; mae: number; bias: number }; volatile: { n: number; mae: number; bias: number } }

/** Save today's per-game values (before the games) for players anyone might roster. */
export async function recordPredictions(date: string, ctx?: ValueContext): Promise<number> {
  const c = ctx ?? (await valueContext());
  const pred: Pred = {};
  for (const p of c.players) {
    if (p.team === "FA" || (p.pctOwned ?? 0) < 5) continue;
    const v = valuePlayer(p, c);
    if (v.status !== "OUT") pred[p.id] = [v.perGame, v.steady];
  }
  await kvStore().set(`value:pred:${date}`, pred);
  return Object.keys(pred).length;
}

/**
 * Compare a night's predictions with what players scored (10+ minutes played), overall and split
 * by steady players (most points from rebounds/assists/stocks) vs scorers. Bias > 0 means we
 * valued them too high.
 */
export async function scorePredictions(night: string, lines: { id: number; fpts: number; min: number }[]): Promise<PredictionScore | null> {
  const kv = kvStore();
  const pred = await kv.get<Pred>(`value:pred:${night}`);
  if (!pred) return null;
  const errs = lines.filter((l) => l.min >= 10 && pred[l.id]).map((l) => ({ e: pred[l.id][0] - l.fpts, steady: pred[l.id][1] >= 0.55 }));
  if (!errs.length) return null;
  const sum = (xs: typeof errs) => {
    const r1 = (n: number) => Math.round(n * 10) / 10;
    return { n: xs.length, mae: r1(xs.reduce((s, x) => s + Math.abs(x.e), 0) / (xs.length || 1)), bias: r1(xs.reduce((s, x) => s + x.e, 0) / (xs.length || 1)) };
  };
  const score: PredictionScore = { date: night, ...sum(errs), steady: sum(errs.filter((x) => x.steady)), volatile: sum(errs.filter((x) => !x.steady)) };
  await kv.set(`value:err:${night}`, score);
  return score;
}
