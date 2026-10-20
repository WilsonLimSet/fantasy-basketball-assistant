import { getPlayers, SEASON } from "./data";
import { fantasyPoints, PRESETS } from "./engine";
import { PRO_TEAM } from "./espn";
import { loadTakes, normName, type Take } from "./takes";
import type { Player } from "./types";

/**
 * Social posts: breaking-news alerts, the week's best streamers and the schedule, each as an
 * image card (/api/card/social) with a caption ready to paste. Built from public data only (ESPN's
 * player pool and NBA schedule plus our own news summaries), so they work without a league.
 */

export const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://takeoverfantasy.com";
const SCORING = PRESETS[0].league.scoring; // ESPN default points: what most leagues use
const SEASON_START = process.env.NBA_SEASON_START ?? "2026-10-20";
/** Below this share of ESPN leagues, a player is probably on your waiver wire. */
const STREAMER_MAX_OWNED = 50;
/** News about players this widely rostered is worth a post. */
const NEWS_MIN_OWNED = 30;

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

/** Per-game fantasy points in ESPN's default scoring: the projection early on, this season's games as they add up. */
export function fppg(p: Player): number {
  const base = p.proj ?? p.last;
  const proj = base ? fantasyPoints(base, SCORING) : 0;
  if (!p.cur?.gp) return proj;
  const w = Math.min(1, p.cur.gp / 10);
  return w * fantasyPoints(p.cur, SCORING) + (1 - w) * proj;
}

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

export interface NewsAlert {
  /** Player id: the card shows this player's latest take. */
  id: number;
  name: string;
  team: string;
  pos: string;
  status: string;
  pctOwned: number;
  label: "Injury" | "Role up" | "Role down" | "News";
  headline: string;
  note: string;
  date: string;
  /** The pickup who gains most when this player sits. */
  nextUp?: { id: number; name: string; team: string; pctOwned: number; fppg: number };
  /** Stable id for de-duplicating auto posts. */
  key: string;
}

const OUT_STATUSES = new Set(["OUT", "INJURY_RESERVE", "SUSPENSION", "DOUBTFUL"]);

/** A teammate at the same position, likely on waivers, who'd soak up the minutes. */
function nextUpFor(p: Player, players: Player[]): NewsAlert["nextUp"] {
  const pick = players
    .filter((q) => q.team === p.team && q.id !== p.id && streamable(q) && (q.pctOwned ?? 100) < STREAMER_MAX_OWNED && q.pos.some((x) => p.pos.includes(x)))
    .sort((a, b) => fppg(b) - fppg(a))[0];
  return pick ? { id: pick.id, name: pick.name, team: pick.team, pctOwned: Math.round(pick.pctOwned ?? 0), fppg: round1(fppg(pick)) } : undefined;
}

const INJURY_WORDS = /injur|sprain|strain|surgery|sore|tight|ankle|knee|calf|hamstring|groin|shoulder|wrist|hip|foot|concussion|illness|day-to-day|questionable|doubtful|ruled out|sidelined|cleared|rehab/i;

function toAlert(p: Player, t: Take, players: Player[]): NewsAlert {
  const note = t.notes[0];
  // Only a real absence gets a pickup; a questionable tag isn't worth a waiver move yet.
  const out = OUT_STATUSES.has(p.injury);
  const injury = out || p.injury !== "ACTIVE" || INJURY_WORDS.test(`${note.headline} ${note.text}`);
  return {
    id: p.id, name: p.name, team: p.team, pos: p.pos.join("/"), status: p.injury, pctOwned: Math.round(p.pctOwned ?? 0),
    label: injury ? "Injury" : t.kind === "boost" ? "Role up" : t.kind === "fade" ? "Role down" : "News",
    headline: note.headline, note: note.text, date: note.date,
    nextUp: out ? nextUpFor(p, players) : undefined,
    key: `${p.id}:${note.date}:${normName(note.headline).slice(0, 40)}`,
  };
}

/** Fresh news (last 2 days) on rostered players, from our takes, newest and biggest names first. */
export async function newsAlerts(limit = 8, now = Date.now()): Promise<NewsAlert[]> {
  const [{ players }, { takes }] = await Promise.all([getPlayers(), loadTakes()]);
  const byName = new Map(players.map((p) => [normName(p.name), p]));
  const since = addDays(easternDate(now), -2);
  const out: NewsAlert[] = [];
  for (const t of takes) {
    const p = byName.get(t.key);
    if (t.notes[0]?.date >= since && p && (p.pctOwned ?? 0) >= NEWS_MIN_OWNED) out.push(toAlert(p, t, players));
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.pctOwned - a.pctOwned).slice(0, limit);
}

/** The latest news card for one player. */
export async function newsAlertFor(playerId: number): Promise<NewsAlert | null> {
  const [{ players }, { takes }] = await Promise.all([getPlayers(), loadTakes()]);
  const p = players.find((x) => x.id === playerId);
  const t = p ? takes.find((x) => x.key === normName(p.name)) : undefined;
  return p && t?.notes[0] ? toAlert(p, t, players) : null;
}

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

/* ---------------- Captions ---------------- */

const TAGS = "#fantasybasketball #nbafantasy #NBA";
const CTA = `Add/drops built for your ESPN team: ${SITE.replace(/^https?:\/\//, "")}`;
const pct = (n: number) => `${n}% rostered`;

/** Shams-style: the news first, in one plain line, then what to do about it. */
export function newsCaption(a: NewsAlert): string {
  const lead = a.label === "Injury" ? "🚨 " : "";
  const move = a.nextUp ? `\n\nFantasy move: pick up ${a.nextUp.name} (${pct(a.nextUp.pctOwned)}, ${a.nextUp.fppg} fpts/g).` : "";
  return `${lead}${a.name} (${a.team}): ${a.headline.replace(/\.$/, "")}.\n\n${a.note}${move}\n\n${CTA}\n${TAGS}`;
}

export function streamersCaption(s: Awaited<ReturnType<typeof streamers>>): string {
  const rows = s.list.map((p, i) => `${i + 1}. ${p.name} (${p.team}): ${p.games} games, ${p.fppg} fpts/g, ${pct(p.pctOwned)}`);
  return `Top ${s.list.length} streamers for ${s.window.label} (${dateRange(s.window.from, s.window.end)}) 📈\n\n${rows.join("\n")}\n\nWhich one fits your roster, and who do you drop? ${CTA}\n${TAGS}`;
}

export function scheduleCaption(s: Awaited<ReturnType<typeof scheduleSpots>>): string {
  const light = s.light.length ? `\n\n${s.fewest} games (bench or stream away): ${s.light.join(", ")}` : "";
  return `${s.window.label} schedule 🗓️\n\n${s.most} games: ${s.heavy.join(", ")}${light}\n\nMore games = more points. ${CTA}\n${TAGS}`;
}
