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
}

export interface StreamMove {
  drop: StreamPlayer;
  add: StreamPlayer & { onWaivers: boolean; percentOwned?: number };
  /** Fantasy points the move adds to this week's started total. */
  pointsGain: number;
  usableGamesGain: number;
  reason: string;
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
}

interface Candidate {
  player: Player;
  value: number;
  /** First scoring period this player can count (pickups on waivers start later). */
  from: number;
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

function simulateWeek(roster: Candidate[], week: MatchupWeekSchedule, today: number, slots: number[]): WeekResult {
  let points = 0;
  let usableGames = 0;
  const usableById = new Map<number, number>();
  for (const day of week.days) {
    if (day.scoringPeriodId < today) continue;
    const playing = roster.filter(
      (c) => day.scoringPeriodId >= c.from && (week.teamGames[c.player.nbaTeamId] ?? []).includes(day.scoringPeriodId)
    );
    const { total, started } = fillDay(playing, slots, (c) => c.value * (PLAY_CHANCE[c.player.status] ?? 1));
    points += total;
    usableGames += started.size;
    for (const id of started) usableById.set(id, (usableById.get(id) ?? 0) + 1);
  }
  return { points, usableGames, usableById };
}

function gamesLeft(p: Player, week: MatchupWeekSchedule, from: number): number {
  return (week.teamGames[p.nbaTeamId] ?? []).filter((d) => d >= from).length;
}

function describe(p: Player, value: number, week: MatchupWeekSchedule, today: number, usable: number, from = today): StreamPlayer {
  return {
    id: p.id,
    name: p.name,
    nbaTeamAbbrev: p.nbaTeamAbbrev,
    positions: p.positions,
    status: p.status,
    fppg: Math.round(value * 10) / 10,
    gamesLeft: gamesLeft(p, week, Math.max(today, from)),
    usableLeft: usable,
  };
}

export function buildStreamingPlan(snapshot: LeagueSnapshot, core: number[], watchIds: number[] = []): StreamingPlan | null {
  const week = snapshot.matchupWeek;
  const me = snapshot.teams.find((t) => t.id === snapshot.myTeamId);
  if (!week || !me?.roster) return null;
  const today = snapshot.scoringPeriodId;

  // One entry per starting spot, by ESPN slot id.
  const slots = Object.entries(snapshot.lineupSlots ?? {}).flatMap(([slot, n]) =>
    Number(slot) === BENCH_SLOT || Number(slot) === IR_SLOT ? [] : Array<number>(n).fill(Number(slot))
  );
  if (!slots.length) return null;

  // Categories leagues have no points to add up, so every game counts the same (ties go to the
  // more widely rostered player).
  const pointsLeague = (snapshot.scoringType ?? '').includes('POINTS');
  const valueOf = (p: Player) =>
    pointsLeague ? expectedFppg(p) : 1 + (p.ownership?.percentOwned ?? 0) / 1000;

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
  });
  const freeAgents = [...pool.values()]
    .filter((fa) => (PLAY_CHANCE[fa.player.status] ?? 1) > 0)
    .map(toCandidate)
    .filter((c) => gamesLeft(c.player, week, c.from) > 0);

  const baseline = simulateWeek(roster, week, today, slots);
  const minGain = pointsLeague ? MIN_POINTS_GAIN : 1;
  const limit = snapshot.acquisitions?.limit ?? null;
  const addsLeft = limit === null ? null : Math.max(0, limit - (snapshot.acquisitions?.used ?? 0));

  function bestSwap(current: Candidate[], drops: Candidate[], adds: Candidate[]) {
    const before = simulateWeek(current, week!, today, slots);
    let best: { drop: Candidate; add: Candidate; result: WeekResult; gain: number } | null = null;
    for (const drop of drops) {
      const rest = current.filter((c) => c.player.id !== drop.player.id);
      for (const add of adds) {
        const result = simulateWeek([...rest, add], week!, today, slots);
        const gain = result.points - before.points;
        if (!best || gain > best.gain) best = { drop, add, result, gain };
      }
    }
    return best && { ...best, before };
  }

  function toMove(s: NonNullable<ReturnType<typeof bestSwap>>): StreamMove {
    const fa = pool.get(s.add.player.id);
    const usableGamesGain = s.result.usableGames - s.before.usableGames;
    const add = describe(s.add.player, s.add.value, week!, today, s.result.usableById.get(s.add.player.id) ?? 0, s.add.from);
    const drop = describe(s.drop.player, s.drop.value, week!, today, s.before.usableById.get(s.drop.player.id) ?? 0);
    const extra = usableGamesGain > 0 ? `+${usableGamesGain} usable game${usableGamesGain === 1 ? '' : 's'}. ` : '';
    const reason = `${extra}${add.name} starts ${add.usableLeft} of his ${add.gamesLeft} games left; ${drop.name} starts ${drop.usableLeft} of ${drop.gamesLeft}.`;
    return {
      drop,
      add: { ...add, onWaivers: !!fa?.onWaivers, percentOwned: fa?.player.ownership?.percentOwned },
      pointsGain: Math.round(s.gain * 10) / 10,
      usableGamesGain,
      reason,
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
    current = [...current.filter((c) => c.player.id !== s.drop.player.id), s.add];
    drops = drops.filter((c) => c.player.id !== s.drop.player.id);
    adds = adds.filter((c) => c.player.id !== s.add.player.id);
  }
  const after = simulateWeek(current, week, today, slots);

  // Watchlist: where each watched player stands, and his best swap on the current roster.
  const rosterIds = new Set(roster.map((c) => c.player.id));
  const watchlist: WatchlistNote[] = [];
  for (const id of watchIds) {
    const fa = pool.get(id);
    if (rosterIds.has(id)) {
      const c = roster.find((r) => r.player.id === id)!;
      watchlist.push({ player: { ...describe(c.player, c.value, week, today, baseline.usableById.get(id) ?? 0), onWaivers: false }, rostered: true });
    } else if (fa) {
      const c = toCandidate(fa);
      const s = bestSwap(roster, droppable, [c]);
      watchlist.push({
        player: { ...describe(c.player, c.value, week, today, s?.result.usableById.get(id) ?? 0, c.from), onWaivers: !!fa.onWaivers },
        bestMove: s && s.gain > 0 ? toMove(s) : undefined,
        rostered: false,
      });
    }
  }

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
    droppable: droppable.map((c) => describe(c.player, c.value, week, today, baseline.usableById.get(c.player.id) ?? 0)),
    watchlist,
  };
}
