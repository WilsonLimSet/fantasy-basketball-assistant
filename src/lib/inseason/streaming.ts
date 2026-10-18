/**
 * Streaming engine
 * Finds the add/drops that add the most fantasy points this matchup week. The point is usable
 * games, not raw games: a pickup only helps on days it gets into the lineup, so every day's
 * lineup is filled the way ESPN would (best players into the slots they're eligible for), and a
 * move is scored by how much the week's started points go up.
 */

import type { FreeAgentEntry, LeagueSnapshot, MatchupWeekSchedule, Player, PlayerStatus } from '@/types';

const BENCH_SLOT = 12;
const IR_SLOT = 13;
/** Minimum points a move must add to be worth a pickup (points leagues). */
const MIN_POINTS_GAIN = 8;
/** Waiver claims need about two days to clear, so they don't count until then. */
const WAIVER_DELAY_DAYS = 2;
/** Most moves to suggest when the league has no weekly pickup limit. */
const MAX_MOVES = 4;

const PLAY_CHANCE: Partial<Record<PlayerStatus, number>> = {
  OUT: 0,
  INJURY_RESERVE: 0,
  SUSPENSION: 0,
  DOUBTFUL: 0.25,
  QUESTIONABLE: 0.6,
  DAY_TO_DAY: 0.6,
};
/**
 * Day-to-day, questionable and doubtful tags are about the next game or two. Games further out
 * count in full, so a minor knock days before the week (or the season) starts doesn't sink a player.
 */
const GAME_TIME_TAGS: PlayerStatus[] = ['DOUBTFUL', 'QUESTIONABLE', 'DAY_TO_DAY'];
const GAME_TIME_DAYS = 2;

/** Today's date in US Eastern time (NBA game days), as YYYY-MM-DD. */
const easternDate = (ms: number) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

function playChance(status: PlayerStatus, daysAhead: number): number {
  if (GAME_TIME_TAGS.includes(status) && daysAhead >= GAME_TIME_DAYS) return 1;
  return PLAY_CHANCE[status] ?? 1;
}

export interface StreamPlayer {
  id: number;
  name: string;
  nbaTeamAbbrev?: string;
  positions: string[];
  status: PlayerStatus;
  /** Fantasy points per game we expect. */
  fppg: number;
  gamesLeft: number;
  /** Games left this week that make the lineup. */
  usableLeft: number;
  /** Games next matchup week (when we know next week's schedule). */
  gamesNext?: number;
}

export interface StreamMove {
  drop: StreamPlayer;
  add: StreamPlayer & { onWaivers: boolean; percentOwned?: number };
  /** Fantasy points the move adds to this week's started total. */
  pointsGain: number;
  usableGamesGain: number;
  reason: string;
  /** Set when it's better to wait: make the move after this day's games (US date and label). */
  swapAfter?: { date: string; label: string };
  /** What the move does to next week, if you kept the added player. */
  nextWeek?: { pointsChange: number; addGames: number; dropGames: number };
  /** Set when the move costs points next week, e.g. dropping someone with a big week coming. */
  nextWeekWarning?: string;
}

export interface WatchlistNote {
  player: StreamPlayer & { onWaivers: boolean };
  /** The best swap for this player, if it adds anything. */
  bestMove?: StreamMove;
  rostered: boolean;
}

export interface StreamingPlan {
  week: number;
  daysLeft: number;
  addsLeft: number | null;
  pointsLeague: boolean;
  /** Started points and usable games left this week with the current roster. */
  baseline: { points: number; usableGames: number };
  /** After the suggested moves. */
  after: { points: number; usableGames: number };
  moves: StreamMove[];
  core: number[];
  /** true when the user hasn't picked core players and we assumed their best starters. */
  coreIsDefault: boolean;
  droppable: StreamPlayer[];
  watchlist: WatchlistNote[];
  /** Every free agent with games left, ranked by what he'd add in your best swap this week. */
  freeAgents: FreeAgentNote[];
}

export interface FreeAgentNote {
  player: StreamPlayer & { onWaivers: boolean; percentOwned?: number };
  /** Points his best swap adds this week (0 if none helps). */
  pointsGain: number;
  dropFor?: string;
}

interface Candidate {
  player: Player;
  value: number;
  /** First scoring period this player can count (pickups on waivers start later). */
  from: number;
  /** For a player being dropped later in the week: he counts on days before this one. */
  until?: number;
  /** Days between making a pickup and the player counting (waiver claims). */
  delay?: number;
}

/** Expected fantasy points per game: projection early in the season, recent form once there's a sample. */
export function expectedFppg(p: Player): number {
  const s = p.stats;
  if (!s) return 0;
  const season = s.seasonAvg ?? 0;
  const gp = s.gamesPlayed ?? 0;
  const proj = s.projectedAvg ?? season;
  if (gp <= 0 || !season) return proj;
  const recent = s.last15Avg || season;
  const played = 0.5 * recent + 0.5 * season;
  const w = Math.min(1, gp / 10); // lean on the projection until about 10 games in
  return w * played + (1 - w) * proj;
}

const isPointsLeague = (snapshot: LeagueSnapshot) => (snapshot.scoringType ?? '').includes('POINTS');

/**
 * What a game from this player is worth: expected fantasy points in points leagues. Categories
 * leagues have no points to add up, so every game counts the same (ties go to the more widely
 * rostered player).
 */
export function playerValue(snapshot: LeagueSnapshot, p: Player): number {
  return isPointsLeague(snapshot) ? expectedFppg(p) : 1 + (p.ownership?.percentOwned ?? 0) / 1000;
}

/** Starting lineup spots by ESPN slot id (bench and IR left out). */
export function startingSlots(snapshot: LeagueSnapshot): number[] {
  return Object.entries(snapshot.lineupSlots ?? {}).flatMap(([slot, n]) =>
    Number(slot) === BENCH_SLOT || Number(slot) === IR_SLOT ? [] : Array<number>(n).fill(Number(slot))
  );
}

/** The best lineup for one day's games: which players start, and their total value. */
export function bestLineup(players: Player[], slots: number[], value: (p: Player) => number): { total: number; started: Set<number> } {
  return fillDay(players.map((p) => ({ player: p, value: value(p), from: 0 })), slots, (c) => c.value);
}

/** Chance a player with this status plays today's game. */
export const playChanceToday = (status: PlayerStatus) => PLAY_CHANCE[status] ?? 1;

/**
 * Fill one day's lineup: highest value first, each into a slot it's eligible for, moving earlier
 * players between slots when that frees a spot (augmenting paths). With weights on players only,
 * this greedy matching is optimal.
 */
function fillDay(players: Candidate[], slots: number[], values: (c: Candidate) => number): { total: number; started: Set<number> } {
  const owner: (number | null)[] = slots.map(() => null);
  const byId = new Map(players.map((c) => [c.player.id, c]));
  const canUse = (c: Candidate, i: number) => c.player.eligibleSlots.includes(slots[i]);

  function place(id: number, seen: Set<number>): boolean {
    const c = byId.get(id)!;
    for (let i = 0; i < slots.length; i++) {
      if (seen.has(i) || !canUse(c, i)) continue;
      seen.add(i);
      if (owner[i] === null || place(owner[i]!, seen)) {
        owner[i] = id;
        return true;
      }
    }
    return false;
  }

  const started = new Set<number>();
  let total = 0;
  for (const c of [...players].sort((a, b) => values(b) - values(a))) {
    if (values(c) <= 0) continue;
    if (place(c.player.id, new Set())) {
      started.add(c.player.id);
      total += values(c);
    }
  }
  return { total, started };
}

interface WeekResult {
  points: number;
  usableGames: number;
  usableById: Map<number, number>;
}

function simulateWeek(roster: Candidate[], week: MatchupWeekSchedule, today: number, slots: number[], asOf: string): WeekResult {
  let points = 0;
  let usableGames = 0;
  const usableById = new Map<number, number>();
  for (const day of week.days) {
    if (day.scoringPeriodId < today) continue;
    const playing = roster.filter(
      (c) =>
        day.scoringPeriodId >= c.from &&
        (c.until === undefined || day.scoringPeriodId < c.until) &&
        (week.teamGames[c.player.nbaTeamId] ?? []).includes(day.scoringPeriodId)
    );
    const ahead = daysBetween(asOf, day.date);
    const { total, started } = fillDay(playing, slots, (c) => c.value * playChance(c.player.status, ahead));
    points += total;
    usableGames += started.size;
    for (const id of started) usableById.set(id, (usableById.get(id) ?? 0) + 1);
  }
  return { points, usableGames, usableById };
}

function gamesLeft(p: Player, week: MatchupWeekSchedule, from: number): number {
  return (week.teamGames[p.nbaTeamId] ?? []).filter((d) => d >= from).length;
}

function describe(p: Player, value: number, week: MatchupWeekSchedule, today: number, usable: number, from = today, next?: MatchupWeekSchedule): StreamPlayer {
  return {
    id: p.id,
    name: p.name,
    nbaTeamAbbrev: p.nbaTeamAbbrev,
    positions: p.positions,
    status: p.status,
    fppg: Math.round(value * 10) / 10,
    gamesLeft: gamesLeft(p, week, Math.max(today, from)),
    usableLeft: usable,
    gamesNext: next ? (next.teamGames[p.nbaTeamId] ?? []).length : undefined,
  };
}

export function buildStreamingPlan(snapshot: LeagueSnapshot, core: number[], watchIds: number[] = []): StreamingPlan | null {
  const week = snapshot.matchupWeek;
  const next = snapshot.nextMatchupWeek;
  const me = snapshot.teams.find((t) => t.id === snapshot.myTeamId);
  if (!week || !me?.roster) return null;
  const today = snapshot.scoringPeriodId;
  const asOf = easternDate(snapshot.fetchedAt);

  const slots = startingSlots(snapshot);
  if (!slots.length) return null;

  const pointsLeague = isPointsLeague(snapshot);
  const valueOf = (p: Player) => playerValue(snapshot, p);

  const roster: Candidate[] = me.roster
    .filter((e) => e.lineupSlotId !== IR_SLOT)
    .map((e) => ({ player: e.player, value: valueOf(e.player), from: today }));

  const coreIsDefault = core.length === 0;
  const coreIds = new Set(
    coreIsDefault ? [...roster].sort((a, b) => b.value - a.value).slice(0, slots.length).map((c) => c.player.id) : core
  );
  const droppable = roster.filter((c) => !coreIds.has(c.player.id));

  const pool = new Map<number, FreeAgentEntry>(snapshot.freeAgentsTopN.map((fa) => [fa.player.id, fa]));
  const toCandidate = (fa: FreeAgentEntry): Candidate => ({
    player: fa.player,
    value: valueOf(fa.player),
    from: today + (fa.onWaivers ? WAIVER_DELAY_DAYS : 0),
    delay: fa.onWaivers ? WAIVER_DELAY_DAYS : 0,
  });
  const freeAgents = [...pool.values()]
    .filter((fa) => (PLAY_CHANCE[fa.player.status] ?? 1) > 0)
    .map(toCandidate)
    .filter((c) => gamesLeft(c.player, week, c.from) > 0);

  const baseline = simulateWeek(roster, week, today, slots, asOf);
  const minGain = pointsLeague ? MIN_POINTS_GAIN : 1;
  const limit = snapshot.acquisitions?.limit ?? null;
  const addsLeft = limit === null ? null : Math.max(0, limit - (snapshot.acquisitions?.used ?? 0));

  const lastDay = week.days[week.days.length - 1]?.scoringPeriodId ?? today;
  /** Days a swap could happen: now, or the day after each of the dropped player's games. */
  const swapDays = (drop: Candidate) => [
    today,
    ...(week.teamGames[drop.player.nbaTeamId] ?? []).filter((d) => d >= today && d < lastDay).map((d) => d + 1),
  ];

  /**
   * The best add/drop and when to make it. Waiting lets the dropped player use his games first
   * (say he plays the opener and the pickup doesn't need that day). Waiting only wins if it adds
   * at least a point, so the default is to move now.
   */
  function bestSwap(current: Candidate[], drops: Candidate[], adds: Candidate[]) {
    const before = simulateWeek(current, week!, today, slots, asOf);
    type Swap = { drop: Candidate; add: Candidate; swapDay: number; roster: Candidate[]; result: WeekResult; gain: number };
    let best: Swap | null = null;
    for (const drop of drops) {
      const rest = current.filter((c) => c.player.id !== drop.player.id);
      const days = [...new Set(swapDays(drop))].sort((a, b) => a - b);
      for (const add of adds) {
        let pick: Swap | null = null;
        for (const day of days) {
          const timedAdd = day === today ? add : { ...add, from: Math.max(add.from, day + (add.delay ?? 0)) };
          const roster = day === today ? [...rest, timedAdd] : [...rest, { ...drop, until: day }, timedAdd];
          const result = simulateWeek(roster, week!, today, slots, asOf);
          const gain = result.points - before.points;
          if (!pick || gain > pick.gain + 1) pick = { drop, add: timedAdd, swapDay: day, roster, result, gain };
        }
        if (pick && (!best || pick.gain > best.gain)) best = pick;
      }
    }
    return best ? { ...best, before, current } : null;
  }

  function toMove(s: NonNullable<ReturnType<typeof bestSwap>>): StreamMove {
    const fa = pool.get(s.add.player.id);
    const usableGamesGain = s.result.usableGames - s.before.usableGames;
    const add = describe(s.add.player, s.add.value, week!, today, s.result.usableById.get(s.add.player.id) ?? 0, s.add.from, next);
    const drop = describe(s.drop.player, s.drop.value, week!, today, s.before.usableById.get(s.drop.player.id) ?? 0, today, next);
    const extra = usableGamesGain > 0 ? `+${usableGamesGain} usable game${usableGamesGain === 1 ? '' : 's'}. ` : '';
    let reason = `${extra}${add.name} starts ${add.usableLeft} of his ${add.gamesLeft} games left; ${drop.name} starts ${drop.usableLeft} of ${drop.gamesLeft}.`;
    // Waiting: the dropped player keeps the games before the swap.
    let swapAfter: StreamMove['swapAfter'];
    if (s.swapDay > today) {
      const date = week!.days.find((d) => d.scoringPeriodId === s.swapDay - 1)?.date ?? '';
      const label = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
      const kept = s.result.usableById.get(s.drop.player.id) ?? 0;
      swapAfter = { date, label };
      reason =
        `Wait: keep ${drop.name} through ${label} (${kept} game${kept === 1 ? '' : 's'} he starts), then make this move after that day's games. ` +
        `${extra}${add.name} starts ${add.usableLeft} of his ${add.gamesLeft} games after that.`;
    }
    let nextWeek: StreamMove['nextWeek'];
    let nextWeekWarning: string | undefined;
    if (next) {
      // Next week with the swap kept, against next week without it.
      const firstNext = next.days[0]?.scoringPeriodId ?? today;
      const kept = simulateWeek([...s.current.filter((c) => c.player.id !== s.drop.player.id), s.add], next, firstNext, slots, asOf).points;
      // (a dropped player waiting out the week is gone by next week either way)
      const without = simulateWeek(s.current, next, firstNext, slots, asOf).points;
      nextWeek = { pointsChange: Math.round(kept - without), addGames: add.gamesNext ?? 0, dropGames: drop.gamesNext ?? 0 };
      if (nextWeek.pointsChange <= -minGain) {
        nextWeekWarning = `Next week ${drop.name} plays ${nextWeek.dropGames} and ${add.name} ${nextWeek.addGames}: keeping ${add.name} would cost ${-nextWeek.pointsChange} pts then.`;
      }
    }
    return {
      drop,
      add: { ...add, onWaivers: !!fa?.onWaivers, percentOwned: fa?.player.ownership?.percentOwned },
      pointsGain: Math.round(s.gain * 10) / 10,
      usableGamesGain,
      reason,
      swapAfter,
      nextWeek,
      nextWeekWarning,
    };
  }

  // Take the best swap, apply it, look again, until pickups run out or nothing helps enough.
  const moves: StreamMove[] = [];
  let current = roster;
  let drops = droppable;
  let adds = freeAgents;
  const maxMoves = addsLeft ?? MAX_MOVES;
  while (moves.length < maxMoves) {
    const s = bestSwap(current, drops, adds);
    if (!s || s.gain < minGain) break;
    moves.push(toMove(s));
    current = s.roster;
    drops = drops.filter((c) => c.player.id !== s.drop.player.id);
    adds = adds.filter((c) => c.player.id !== s.add.player.id);
  }
  const after = simulateWeek(current, week, today, slots, asOf);

  // Watchlist: where each watched player stands, and his best swap on the current roster.
  const rosterIds = new Set(roster.map((c) => c.player.id));
  const watchlist: WatchlistNote[] = [];
  for (const id of watchIds) {
    const fa = pool.get(id);
    if (rosterIds.has(id)) {
      const c = roster.find((r) => r.player.id === id)!;
      watchlist.push({ player: { ...describe(c.player, c.value, week, today, baseline.usableById.get(id) ?? 0, today, next), onWaivers: false }, rostered: true });
    } else if (fa) {
      const c = toCandidate(fa);
      const s = bestSwap(roster, droppable, [c]);
      watchlist.push({
        player: { ...describe(c.player, c.value, week, today, s?.result.usableById.get(id) ?? 0, c.from, next), onWaivers: !!fa.onWaivers },
        bestMove: s && s.gain > 0 ? toMove(s) : undefined,
        rostered: false,
      });
    }
  }

  const faNotes: FreeAgentNote[] = freeAgents.map((c) => {
    const s = bestSwap(roster, droppable, [c]);
    const fa = pool.get(c.player.id);
    return {
      player: {
        ...describe(c.player, c.value, week, today, s?.result.usableById.get(c.player.id) ?? 0, c.from, next),
        onWaivers: !!fa?.onWaivers,
        percentOwned: fa?.player.ownership?.percentOwned,
      },
      pointsGain: s && s.gain > 0 ? Math.round(s.gain * 10) / 10 : 0,
      dropFor: s && s.gain > 0 ? s.drop.player.name : undefined,
    };
  });
  faNotes.sort((a, b) => b.pointsGain - a.pointsGain || b.player.fppg * b.player.gamesLeft - a.player.fppg * a.player.gamesLeft);

  // Worth-a-move players first, biggest gain on top; rostered ones last.
  const rank = (w: WatchlistNote) => (w.rostered ? -2 : w.bestMove ? w.bestMove.pointsGain : -1);
  watchlist.sort((a, b) => rank(b) - rank(a));

  const round = (r: WeekResult) => ({ points: Math.round(r.points), usableGames: r.usableGames });
  return {
    week: snapshot.week,
    daysLeft: week.days.filter((d) => d.scoringPeriodId >= today).length,
    addsLeft,
    pointsLeague,
    baseline: round(baseline),
    after: round(after),
    moves,
    core: [...coreIds],
    coreIsDefault,
    droppable: droppable.map((c) => describe(c.player, c.value, week, today, baseline.usableById.get(c.player.id) ?? 0, today, next)),
    watchlist,
    freeAgents: faNotes.slice(0, 40),
  };
}
