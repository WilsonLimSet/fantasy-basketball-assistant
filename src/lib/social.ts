import { createHmac, timingSafeEqual } from "node:crypto";
import { getPlayers, SEASON } from "./data";
import { PRO_TEAM } from "./espn";
import { kvStore } from "./inseason/storage";
import { perGameCore } from "./valueCore";
import { loadHealth, type HealthProfile } from "./healthHistory";
import { loadTakes, normName, type Take } from "./takes";
import type { Player } from "./types";

/**
 * Social posts: breaking-news alerts, the week's best streamers and the schedule, each as an
 * image card (/api/card/social) with a caption ready to paste. Built from public data only (ESPN's
 * player pool and NBA schedule plus our own news summaries), so they work without a league.
 */

export const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://takeoverfantasy.com";
const SEASON_START = process.env.NBA_SEASON_START ?? "2026-10-20";
/** Below this share of ESPN leagues, a player is probably on your waiver wire. */
const STREAMER_MAX_OWNED = 50;
/** News about players this widely rostered is worth a post. */
const NEWS_MIN_OWNED = 30;

const cardSig = (query: string) =>
  createHmac("sha256", process.env.CV_SECRET ?? "dev-secret-change-me").update(`card:${query}`).digest("base64url").slice(0, 16);

/**
 * A signed card link. Rendering a card costs a few seconds of server time, so the card route only
 * draws links we made (Telegram, email, the studio); made-up variations that would miss the CDN cache are refused.
 */
export const cardUrl = (query: string, absolute = true) => `${absolute ? SITE : ""}/api/card/social?${query}&s=${cardSig(query)}`;

/** The query a card link was signed for, or null when the signature doesn't match. */
export function verifiedCardQuery(search: string): string | null {
  const cut = search.lastIndexOf("&s=");
  if (cut < 0) return null;
  const query = search.slice(0, cut), sig = search.slice(cut + 3);
  const want = cardSig(query);
  return sig.length === want.length && timingSafeEqual(Buffer.from(sig), Buffer.from(want)) ? query : null;
}

export const easternDate = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const weekday = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();
export const shortDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** "Oct 19–25", or "Oct 27–Nov 2" across months. */
export function dateRange(from: string, to: string) {
  const a = shortDate(from), b = shortDate(to);
  return a.split(" ")[0] === b.split(" ")[0] ? `${a}–${b.split(" ")[1]}` : `${a}–${b}`;
}

/** The Monday-to-Sunday week a date is in (ESPN's matchup weeks). */
export function weekOf(date: string) {
  const start = addDays(date, -((weekday(date) + 6) % 7));
  return { start, end: addDays(start, 6) };
}

/** Matchup week number, counting the opening (partial) week as week 1. */
export function weekNumber(date: string) {
  const first = Date.parse(weekOf(SEASON_START).start);
  return Math.max(1, Math.floor((Date.parse(weekOf(date).start) - first) / (7 * 864e5)) + 1);
}

/** Per-game fantasy points in ESPN's default scoring when he plays (see src/lib/valueCore.ts). */
export const fppg = (p: Player): number => perGameCore(p).perGame;

export const round1 = (n: number) => Math.round(n * 10) / 10;

/* ---------------- Schedule ---------------- */

const SCHEDULE = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/${SEASON}?view=proTeamSchedules_wl`;

/** Tip-off times (ms) for each team's games, from ESPN's public schedule. Cached for 6 hours. */
export async function teamTips(): Promise<Map<string, number[]>> {
  const r = await fetch(SCHEDULE, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; TakeoverFantasy/0.1)" },
    next: { revalidate: 6 * 60 * 60 },
  });
  if (!r.ok) throw new Error(`ESPN schedule: ${r.status}`);
  const j = await r.json();
  const tips = new Map<string, number[]>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const t of (j?.settings?.proTeams ?? []) as any[]) {
    const team = PRO_TEAM[t.id];
    if (!team || team === "FA") continue;
    const seen = new Set<number>();
    const list: number[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const games of Object.values(t.proGamesByScoringPeriod ?? {}) as any[][]) {
      for (const g of games) if (!seen.has(g.id)) { seen.add(g.id); list.push(Number(g.date)); }
    }
    tips.set(team, list.sort((a, b) => a - b));
  }
  return tips;
}

export interface StreamWindow {
  week: number;
  /** First and last US dates counted. */
  from: string;
  end: string;
  /** "Rest of Week 3" or "Week 4". */
  label: string;
  nextWeek: boolean;
}

/** The games that matter for a pickup today: the rest of this week, or next week from Saturday on. */
export function streamWindow(now = Date.now()): StreamWindow {
  const today = easternDate(now);
  const { end } = weekOf(today);
  const late = weekday(today) === 6 || weekday(today) === 0;
  const from = late ? addDays(end, 1) : today;
  const to = late ? addDays(end, 7) : end;
  const week = weekNumber(from);
  const fullWeek = from === weekOf(from).start || from === SEASON_START;
  return { week, from, end: to, label: fullWeek ? `Week ${week}` : `Rest of Week ${week}`, nextWeek: late };
}

/** Games each team has left in the window (games already tipped off don't count). */
export function gamesIn(tips: Map<string, number[]>, w: StreamWindow, now = Date.now()) {
  const out = new Map<string, number>();
  for (const [team, list] of tips) {
    out.set(team, list.filter((t) => t > now && easternDate(t) >= w.from && easternDate(t) <= w.end).length);
  }
  return out;
}

/* ---------------- Posts ---------------- */

export interface Streamer {
  id: number;
  name: string;
  team: string;
  pos: string;
  games: number;
  fppg: number;
  pctOwned: number;
  pctChange: number;
}

const streamable = (p: Player) => p.team !== "FA" && (p.injury === "ACTIVE" || p.injury === "DAY_TO_DAY");

/** Widely available players whose games left this week add the most points. */
export async function streamers(limit = 5, now = Date.now()): Promise<{ window: StreamWindow; list: Streamer[] }> {
  const [{ players }, tips] = await Promise.all([getPlayers(), teamTips()]);
  const window = streamWindow(now);
  const games = gamesIn(tips, window, now);
  const list = players
    .filter((p) => streamable(p) && p.pctOwned != null && p.pctOwned >= 0.5 && p.pctOwned < STREAMER_MAX_OWNED)
    .map((p) => ({ p, g: games.get(p.team) ?? 0, f: fppg(p) }))
    .filter((x) => x.g >= 2 && x.f > 0)
    .sort((a, b) => b.f * b.g - a.f * a.g)
    .slice(0, limit)
    .map(({ p, g, f }) => ({
      id: p.id, name: p.name, team: p.team, pos: p.pos.join("/"), games: g, fppg: round1(f),
      pctOwned: Math.round(p.pctOwned ?? 0), pctChange: round1(p.pctChange ?? 0),
    }));
  return { window, list };
}

/** The players ESPN managers added most over the last day. */
export async function mostAdded(limit = 10): Promise<Player[]> {
  const { players } = await getPlayers();
  return players.filter((p) => (p.pctChange ?? 0) > 0).sort((a, b) => (b.pctChange ?? 0) - (a.pctChange ?? 0)).slice(0, limit);
}

export interface Mover { id: number; name: string; team: string; pos: string; pctOwned: number; pctChange: number }

const mover = (p: Player): Mover => ({
  id: p.id, name: p.name, team: p.team, pos: p.pos.join("/"), pctOwned: Math.round(p.pctOwned ?? 0), pctChange: round1(p.pctChange ?? 0),
});

/** The players ESPN managers added and dropped most over the last day (change in % rostered). */
export async function risersFallers(limit = 5): Promise<{ date: string; risers: Mover[]; fallers: Mover[] }> {
  const { players } = await getPlayers();
  const moved = players.filter((p) => p.team !== "FA" && Math.abs(p.pctChange ?? 0) >= 0.5);
  return {
    date: easternDate(Date.now()),
    risers: moved.filter((p) => (p.pctChange ?? 0) > 0).sort((a, b) => (b.pctChange ?? 0) - (a.pctChange ?? 0)).slice(0, limit).map(mover),
    fallers: moved.filter((p) => (p.pctChange ?? 0) < 0).sort((a, b) => (a.pctChange ?? 0) - (b.pctChange ?? 0)).slice(0, limit).map(mover),
  };
}

export interface MinutesMove { id: number; name: string; team: string; pos: string; pctOwned: number; min: number; lastMin: number; gp: number; fppg: number; healthy: boolean }

/** Minutes this season worth a slide: a starter's job or a real rotation spot, not garbage time. */
const MINUTES_MIN = 22;

/**
 * Minutes this season against last season: available players whose role grew (the first sign of a
 * breakout, before the box scores make it obvious) and rostered ones whose role shrank.
 */
export async function minutesWatch(limit = 4): Promise<{ date: string; up: MinutesMove[]; down: MinutesMove[] }> {
  const { players } = await getPlayers();
  const moves = players
    .filter((p) => p.team !== "FA" && p.cur?.gp && p.last?.gp && p.last.gp >= 10 && p.pctOwned != null)
    .map((p) => ({
      id: p.id, name: p.name, team: p.team, pos: p.pos.join("/"), pctOwned: Math.round(p.pctOwned ?? 0),
      min: round1(p.cur!.min), lastMin: round1(p.last!.min), gp: p.cur!.gp, fppg: round1(fppg(p)), healthy: p.injury === "ACTIVE",
    }));
  const gain = (m: MinutesMove) => m.min - m.lastMin;
  return {
    date: easternDate(Date.now()),
    up: moves.filter((m) => m.pctOwned < STREAMER_MAX_OWNED && m.min >= MINUTES_MIN && gain(m) >= 4).sort((a, b) => gain(b) - gain(a)).slice(0, limit),
    // Banged-up players play fewer minutes for a reason that isn't their role.
    down: moves.filter((m) => m.healthy && m.pctOwned >= STREAMER_MAX_OWNED && gain(m) <= -5).sort((a, b) => gain(a) - gain(b)).slice(0, 2),
  };
}

export interface NewsAlert {
  /** Player id: the card shows this player's latest take. */
  id: number;
  name: string;
  team: string;
  pos: string;
  status: string;
  pctOwned: number;
  label: "Injury" | "Transaction" | "Role up" | "Role down" | "News";
  headline: string;
  note: string;
  date: string;
  /** The pickup who gains most when this player sits. */
  nextUp?: { id: number; name: string; team: string; pctOwned: number; fppg: number };
  /** Ruled out, rather than day-to-day or questionable. Only these get a pickup and an auto post. */
  out: boolean;
  /** Stable id for de-duplicating auto posts. */
  key: string;
}

const OUT_STATUSES = new Set(["OUT", "INJURY_RESERVE", "SUSPENSION", "DOUBTFUL"]);

type Health = Record<string, HealthProfile>;

/**
 * A teammate at the same position, likely on waivers, who'd soak up the minutes. Players who sit
 * often (from their game logs) rank lower: a pickup who misses the games doesn't help.
 */
function nextUpFor(p: Player, players: Player[], health: Health = {}): NewsAlert["nextUp"] {
  const score = (q: Player) => fppg(q) * (health[q.id] && health[q.id].label !== "unknown" ? health[q.id].baseline : 0.88);
  const pick = players
    .filter((q) => q.team === p.team && q.id !== p.id && streamable(q) && (q.pctOwned ?? 100) < STREAMER_MAX_OWNED && q.pos.some((x) => p.pos.includes(x)))
    .sort((a, b) => score(b) - score(a))[0];
  return pick ? { id: pick.id, name: pick.name, team: pick.team, pctOwned: Math.round(pick.pctOwned ?? 0), fppg: round1(fppg(pick)) } : undefined;
}

const INJURY_WORDS = /injur|sprain|strain|surgery|sore|tight|ankle|knee|calf|hamstring|groin|shoulder|wrist|hip|foot|concussion|illness|day-to-day|questionable|doubtful|ruled out|sidelined|cleared|rehab/i;

const TRANSACTION_WORDS = /\b(waive[ds]?|waiving|release[ds]?|traded?|trading|signs?|signed|signing|claimed|acquire[ds]?|buyout|cut)\b/i;

function toAlert(p: Player, t: Take, players: Player[], health: Health = {}): NewsAlert {
  const note = t.notes[0];
  const out = OUT_STATUSES.has(p.injury);
  const text = `${note.headline} ${note.text}`;
  // A move (waived, traded, signed) changes a player's whole outlook, injury or not.
  // (A contract extension "signs" too, but changes nothing this season.)
  const transaction = p.team === "FA" || (TRANSACTION_WORDS.test(text) && !/extension/i.test(text));
  const injury = !transaction && (out || p.injury !== "ACTIVE" || INJURY_WORDS.test(text));
  return {
    id: p.id, name: p.name, team: p.team, pos: p.pos.join("/"), status: p.injury, pctOwned: Math.round(p.pctOwned ?? 0),
    label: transaction ? "Transaction" : injury ? "Injury" : t.kind === "boost" ? "Role up" : t.kind === "fade" ? "Role down" : "News",
    headline: note.headline, note: note.text, date: note.date,
    // Only a real absence gets a pickup; a day-to-day tag isn't worth a waiver move yet.
    nextUp: out ? nextUpFor(p, players, health) : undefined,
    out,
    key: `${p.id}:${note.date}:${normName(note.headline).slice(0, 40)}`,
  };
}

/** Fresh news (last 2 days) on rostered players, from our takes, newest and biggest names first. */
export async function newsAlerts(limit = 8, now = Date.now()): Promise<NewsAlert[]> {
  const [{ players }, { takes }, health] = await Promise.all([getPlayers(), loadTakes(), loadHealth()]);
  const byName = new Map(players.map((p) => [normName(p.name), p]));
  const since = addDays(easternDate(now), -2);
  const out: NewsAlert[] = [];
  for (const t of takes) {
    const p = byName.get(t.key);
    if (t.notes[0]?.date >= since && p && (p.pctOwned ?? 0) >= NEWS_MIN_OWNED) out.push(toAlert(p, t, players, health));
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.pctOwned - a.pctOwned).slice(0, limit);
}

/** The latest news card for one player. */
export async function newsAlertFor(playerId: number): Promise<NewsAlert | null> {
  const [{ players }, { takes }, health] = await Promise.all([getPlayers(), loadTakes(), loadHealth()]);
  const p = players.find((x) => x.id === playerId);
  const t = p ? takes.find((x) => x.key === normName(p.name)) : undefined;
  return p && t?.notes[0] ? toAlert(p, t, players, health) : null;
}

export const OUT = OUT_STATUSES;

export interface ReturnAlert {
  id: number;
  name: string;
  team: string;
  pos: string;
  pctOwned: number;
  headline: string;
  note: string | null;
  /** The teammate who'd been filling in, likely to lose minutes now. */
  loser?: NewsAlert["nextUp"];
}

/**
 * A player back from injury, and who loses minutes. (Our latest note is usually the injury itself,
 * so it's left out rather than contradicting the card.)
 */
export async function returnAlertFor(playerId: number): Promise<ReturnAlert | null> {
  const { players } = await getPlayers();
  const p = players.find((x) => x.id === playerId);
  if (!p) return null;
  return {
    id: p.id, name: p.name, team: p.team, pos: p.pos.join("/"), pctOwned: Math.round(p.pctOwned ?? 0),
    headline: `${p.name.split(" ").slice(-1)[0]} is back in the lineup`,
    note: "Off the injury report and available to play.",
    loser: nextUpFor(p, players),
  };
}

const NBA = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
/** ESPN's scoreboard codes that differ from the fantasy API's (ours). */
const BOX_TEAM: Record<string, string> = { UTAH: "UTA", GS: "GSW", NO: "NOP", NY: "NYK", SA: "SAS", WSH: "WAS" };
/** Fantasy points in ESPN's default scoring from a box-score line. */
const boxPoints = (b: Record<string, number>) =>
  b.pts + b.tpm - b.fga + 2 * b.fgm - b.fta + b.ftm + b.reb + 2 * b.ast + 4 * b.stl + 4 * b.blk - 2 * b.tov;

export interface Hero { id: number; name: string; team: string; pctOwned: number; fpts: number; line: string; short: string }
export interface BoxLine extends Hero { min: number }

/**
 * Every player's fantasy line on a US date, from ESPN's box scores. Only finished games count:
 * a live game's line looks final but isn't.
 */
export async function boxLines(date: string): Promise<{ date: string; games: number; lines: BoxLine[] }> {
  const get = async (url: string) => {
    const r = await fetch(url, { headers: { Accept: "application/json" }, next: { revalidate: 600 } });
    if (!r.ok) throw new Error(`ESPN ${url}: ${r.status}`);
    return r.json();
  };
  const board = await get(`${NBA}/scoreboard?dates=${date.replace(/-/g, "")}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const done = ((board?.events ?? []) as any[]).filter((e) => e?.status?.type?.completed).map((e) => String(e.id));
  if (!done.length) return { date, games: 0, lines: [] };
  const [{ players }, boxes] = await Promise.all([getPlayers(), Promise.all(done.map((id) => get(`${NBA}/summary?event=${id}`).catch(() => null)))]);
  const owned = new Map(players.map((p) => [p.id, p.pctOwned ?? 0]));
  const lines: BoxLine[] = [];
  for (const box of boxes) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const side of (box?.boxscore?.players ?? []) as any[]) {
      const st = side.statistics?.[0];
      const keys: string[] = st?.keys ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const a of (st?.athletes ?? []) as any[]) {
        if (a.didNotPlay || !a.stats?.length) continue;
        const id = Number(a.athlete?.id);
        const v = (k: string) => a.stats[keys.indexOf(k)] ?? "0";
        const split = (k: string) => v(k).split("-").map(Number);
        const [fgm, fga] = split("fieldGoalsMade-fieldGoalsAttempted"), [tpm] = split("threePointFieldGoalsMade-threePointFieldGoalsAttempted"), [ftm, fta] = split("freeThrowsMade-freeThrowsAttempted");
        const b = { pts: Number(v("points")), reb: Number(v("rebounds")), ast: Number(v("assists")), stl: Number(v("steals")), blk: Number(v("blocks")), tov: Number(v("turnovers")), fgm, fga, tpm, ftm, fta };
        if (Object.values(b).some((x) => !Number.isFinite(x))) continue;
        const extras = [b.stl >= 2 && `${b.stl} stl`, b.blk >= 2 && `${b.blk} blk`, b.tpm >= 3 && `${b.tpm} 3pm`].filter(Boolean);
        lines.push({
          id, name: String(a.athlete?.displayName ?? ""), team: BOX_TEAM[side.team?.abbreviation] ?? String(side.team?.abbreviation ?? ""),
          pctOwned: Math.round(owned.get(id) ?? 0), fpts: Math.round(boxPoints(b)), min: Number(v("minutes")) || 0,
          line: [`${b.pts} pts`, `${b.reb} reb`, `${b.ast} ast`, ...extras].join(", "),
          short: `${b.pts}p ${b.reb}r ${b.ast}a${b.stl >= 2 ? ` ${b.stl}s` : ""}${b.blk >= 2 ? ` ${b.blk}b` : ""}`,
        });
      }
    }
  }
  return { date, games: done.length, lines };
}

/** The best fantasy games on a US date from players under 50% rostered. */
export async function waiverHeroes(date: string, limit = 5): Promise<{ date: string; games: number; list: Hero[] }> {
  const { games, lines } = await boxLines(date);
  const list = lines.filter((l) => l.pctOwned < STREAMER_MAX_OWNED).sort((x, y) => y.fpts - x.fpts).slice(0, limit).map(({ min: _min, ...h }) => h);
  return { date, games, list };
}

export const yesterday = (now = Date.now()) => addDays(easternDate(now), -1);

/** Teams by games in the window: who to stream from and whose players will sit idle. */
export async function scheduleSpots(now = Date.now()) {
  const window = streamWindow(now);
  const games = gamesIn(await teamTips(), window, now);
  const teams = [...games.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const most = teams[0]?.[1] ?? 0;
  const fewest = teams.at(-1)?.[1] ?? 0;
  return {
    window,
    most,
    fewest,
    heavy: teams.filter(([, g]) => g === most).map(([t]) => t),
    light: teams.filter(([, g]) => g === fewest && g < most).map(([t]) => t),
  };
}

/* ---------------- Daily slideshow ---------------- */

/** One line on the injury slide: a player ruled out (and who to add) or back (and who loses minutes). */
export interface InjuryItem {
  kind: "out" | "back";
  player: { id: number; name: string; team: string; pctOwned: number };
  other?: { id: number; name: string; pctOwned: number };
}

const injuriesKey = (date: string) => `social:injuries:${date}`;
/** The day's injury lines are worked out once by the news run, then read by the slide and caption. */
export const saveInjuries = (date: string, items: InjuryItem[]) => kvStore().set(injuriesKey(date), items);
export const loadInjuries = async (date: string) => (await kvStore().get<InjuryItem[]>(injuriesKey(date)).catch(() => null)) ?? [];

/** Everything on a day's slideshow (date = the US date it's posted). */
/**
 * The day's slideshow content, each player shown once: the cover's best pickup, then the next
 * waiver heroes, then trending and minutes moves that aren't already on an earlier slide.
 */
export async function dailyContent(date: string) {
  const night = addDays(date, -1);
  const [allHeroes, allMovers, injuries, allMinutes] = await Promise.all([
    waiverHeroes(night, 6).catch(() => ({ date: night, games: 0, list: [] as Hero[] })),
    risersFallers(10).catch(() => ({ date, risers: [] as Mover[], fallers: [] as Mover[] })),
    loadInjuries(date),
    minutesWatch(10).catch(() => ({ date, up: [] as MinutesMove[], down: [] as MinutesMove[] })),
  ]);
  const seen = new Set<number>();
  const fresh = <T extends { id: number }>(list: T[], n: number) => {
    const out = list.filter((x) => !seen.has(x.id)).slice(0, n);
    out.forEach((x) => seen.add(x.id));
    return out;
  };
  const [top] = fresh(allHeroes.list, 1);
  const heroes = { ...allHeroes, list: fresh(allHeroes.list, 5) };
  const movers = { ...allMovers, risers: fresh(allMovers.risers, 4), fallers: fresh(allMovers.fallers, 2) };
  const minutes = { ...allMinutes, up: fresh(allMinutes.up, 4), down: fresh(allMinutes.down, 2) };
  return { date, night, top, heroes, movers, injuries, minutes };
}

export function dailyCaption(c: Awaited<ReturnType<typeof dailyContent>>): string {
  // A new brand's name means nothing yet: lead with the news, the best pickup nobody has.
  const lines = c.top
    ? [`${c.top.name} put up ${c.top.fpts} fantasy points last night (${c.top.short}) and he's on waivers in ${100 - Math.round(c.top.pctOwned)}% of leagues 👀`, "", `Today's waiver wire, ${shortDate(c.date)}:`]
    : [`Today's fantasy waiver wire, ${shortDate(c.date)} 🏀`, ""];
  if (c.heroes.list.length) lines.push(`📊 Also went off: ${c.heroes.list.slice(0, 3).map((h) => `${h.name} (${h.fpts} fpts, ${pct(h.pctOwned)})`).join(", ")}`);
  if (c.movers.risers.length) lines.push(`📈 Everyone's adding: ${c.movers.risers.slice(0, 3).map((m) => `${m.name} (+${m.pctChange}%)`).join(", ")}`);
  if (c.movers.fallers.length) lines.push(`📉 Getting dropped: ${c.movers.fallers.slice(0, 2).map((m) => m.name).join(", ")}`);
  if (c.minutes.up.length) lines.push(`⏱️ Minutes up: ${c.minutes.up.slice(0, 3).map((m) => `${m.name} (${m.min} min, ${m.lastMin} last season)`).join(", ")}`);
  const outs = c.injuries.filter((i) => i.kind === "out" && i.other);
  if (outs.length) lines.push(`🚑 Injury pickups: ${outs.slice(0, 2).map((i) => `${i.player.name} out → add ${i.other!.name}`).join("; ")}`);
  lines.push("", "Every league's waiver wire is different. Find the moves for yours: takeoverfantasy.com", TAGS);
  return lines.join("\n");
}

/* ---------------- Captions ---------------- */

const TAGS = "#fantasybasketball #nbafantasy #NBA";
const CTA = `Add/drops built for your fantasy team: ${SITE.replace(/^https?:\/\//, "")}`;
const pct = (n: number) => (n < 1 ? "under 1% rostered" : `${n}% rostered`);

/** Shams-style: the news first, in one plain line, then what to do about it. */
export function newsCaption(a: NewsAlert): string {
  const lead = a.label === "Injury" || a.label === "Transaction" ? "🚨 " : "";
  const move = a.nextUp ? `\n\nFantasy move: pick up ${a.nextUp.name} (${pct(a.nextUp.pctOwned)}, ${a.nextUp.fppg} fpts/g).` : "";
  return `${lead}${a.name} (${a.team}): ${a.headline.replace(/\.$/, "")}.\n\n${a.note}${move}\n\n${CTA}\n${TAGS}`;
}

export function streamersCaption(s: Awaited<ReturnType<typeof streamers>>): string {
  const rows = s.list.map((p, i) => `${i + 1}. ${p.name} (${p.team}): ${p.games} games, ${p.fppg} fpts/g, ${pct(p.pctOwned)}`);
  return `Top ${s.list.length} streamers for ${s.window.label} (${dateRange(s.window.from, s.window.end)}) 📈\n\n${rows.join("\n")}\n\nWhich one fits your roster, and who do you drop? ${CTA}\n${TAGS}`;
}

export function risersCaption(r: Awaited<ReturnType<typeof risersFallers>>): string {
  const row = (m: Mover) => `${m.name} (${m.team}) ${m.pctChange > 0 ? "+" : ""}${m.pctChange}%, now ${m.pctOwned}% rostered`;
  const up = r.risers.map((m) => `📈 ${row(m)}`).join("\n");
  const down = r.fallers.length ? `\n\nGetting dropped:\n${r.fallers.map((m) => `📉 ${row(m)}`).join("\n")}` : "";
  return `Who ESPN managers are adding right now 👀\n\n${up}${down}\n\nAre you early or late? ${CTA}\n${TAGS}`;
}

export function returnCaption(r: ReturnAlert): string {
  const loser = r.loser ? `\n\nWho loses minutes: ${r.loser.name}. If you picked him up as a fill-in, he's a drop candidate.` : "";
  return `✅ ${r.name} (${r.team}) is cleared to return.${r.note ? `\n\n${r.note}` : ""}${loser}\n\n${CTA}\n${TAGS}`;
}

export function heroesCaption(h: Awaited<ReturnType<typeof waiverHeroes>>): string {
  const rows = h.list.map((x, i) => `${i + 1}. ${x.name} (${x.team}): ${x.fpts} fpts, ${x.line}. ${pct(x.pctOwned)}`);
  return `Last night's waiver heroes 🦸 All under 50% rostered.\n\n${rows.join("\n")}\n\nOne-night wonder or real pickup? ${CTA}\n${TAGS}`;
}

export function scheduleCaption(s: Awaited<ReturnType<typeof scheduleSpots>>): string {
  const light = s.light.length ? `\n\n${s.fewest} games (bench or stream away): ${s.light.join(", ")}` : "";
  return `${s.window.label} schedule 🗓️\n\n${s.most} games: ${s.heavy.join(", ")}${light}\n\nMore games = more points. ${CTA}\n${TAGS}`;
}
