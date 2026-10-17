/**
 * Matchup games
 * How many games each player plays in the current matchup week, for both sides of the matchup.
 */

import type {
  LeagueSnapshot,
  MatchupGamesComparison,
  MatchupSideGames,
  MatchupWeekSchedule,
  Team,
} from '@/types';

const BENCH_SLOT = 12;
const IR_SLOT = 13;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Calendar date (YYYY-MM-DD) of a game in US Eastern time, which is how ESPN splits days. */
function easternDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

type ProTeamSchedule = Array<{ id: number; proGamesByScoringPeriod?: Record<string, Array<{ date: number }>> }>;

/** The calendar date of each scoring period, anchored on any game in the schedule. */
function periodDates(nbaSchedule: ProTeamSchedule): ((period: number) => string) | undefined {
  for (const team of nbaSchedule) {
    for (const [period, games] of Object.entries(team.proGamesByScoringPeriod ?? {})) {
      if (games[0]) {
        const anchorMs = Date.parse(`${easternDate(games[0].date)}T12:00:00Z`);
        const anchorPeriod = Number(period);
        return (p: number) => new Date(anchorMs + (p - anchorPeriod) * DAY_MS).toISOString().slice(0, 10);
      }
    }
  }
  return undefined;
}

function scheduleFor(nbaSchedule: ProTeamSchedule, periods: number[], dateOf: (p: number) => string): MatchupWeekSchedule {
  const inWeek = new Set(periods);
  const teamGames: Record<number, number[]> = {};
  for (const team of nbaSchedule) {
    teamGames[team.id] = Object.entries(team.proGamesByScoringPeriod ?? {})
      .filter(([period, games]) => games.length > 0 && inWeek.has(Number(period)))
      .map(([period]) => Number(period))
      .sort((a, b) => a - b);
  }
  return { days: periods.map((p) => ({ scoringPeriodId: p, date: dateOf(p) })), teamGames };
}

/**
 * Days of the current matchup week and which of them each NBA team plays.
 * Uses the league's matchup period mapping. Before the season ESPN maps every matchup period to a
 * single day, so in that case the week runs from today through Sunday (ESPN weeks end on Sunday).
 */
export function buildMatchupWeek(
  nbaSchedule: ProTeamSchedule,
  matchupPeriods: Record<string, number[]> | undefined,
  currentMatchupPeriod: number,
  currentScoringPeriod: number
): MatchupWeekSchedule | undefined {
  const dateOf = periodDates(nbaSchedule);
  if (!dateOf) return undefined;
  let periods = matchupPeriods?.[String(currentMatchupPeriod)] ?? [];
  if (periods.length <= 1) {
    const dow = new Date(`${dateOf(currentScoringPeriod)}T12:00:00Z`).getUTCDay(); // 0 = Sunday
    const daysToSunday = (7 - dow) % 7;
    periods = Array.from({ length: daysToSunday + 1 }, (_, i) => currentScoringPeriod + i);
  }
  return scheduleFor(nbaSchedule, periods, dateOf);
}

/**
 * The matchup week after this one: the league's next matchup period, or (when ESPN hasn't mapped
 * it to real days yet, as before the season) the Monday-to-Sunday week after this one ends.
 */
export function buildNextMatchupWeek(
  nbaSchedule: ProTeamSchedule,
  matchupPeriods: Record<string, number[]> | undefined,
  currentMatchupPeriod: number,
  thisWeek: MatchupWeekSchedule | undefined
): MatchupWeekSchedule | undefined {
  const dateOf = periodDates(nbaSchedule);
  const last = thisWeek?.days[thisWeek.days.length - 1]?.scoringPeriodId;
  if (!dateOf || last === undefined) return undefined;
  let periods = matchupPeriods?.[String(currentMatchupPeriod + 1)] ?? [];
  if (periods.length <= 1 || periods[0] <= last) periods = Array.from({ length: 7 }, (_, i) => last + 1 + i);
  return scheduleFor(nbaSchedule, periods, dateOf);
}

/** Starting lineup spots: every slot except bench and IR. */
export function countStartingSlots(lineupSlotCounts: Record<string, number> | undefined): number {
  return Object.entries(lineupSlotCounts ?? {})
    .filter(([slot]) => Number(slot) !== BENCH_SLOT && Number(slot) !== IR_SLOT)
    .reduce((sum, [, n]) => sum + n, 0);
}

function sideGames(team: Team, week: MatchupWeekSchedule, today: number, slots: number): MatchupSideGames {
  const players = (team.roster ?? []).map((entry) => {
    const p = entry.player;
    const played = new Set(week.teamGames[p.nbaTeamId] ?? []);
    const playsByDay = week.days.map((d) => played.has(d.scoringPeriodId));
    return {
      playerId: p.id,
      name: p.name,
      nbaTeamAbbrev: p.nbaTeamAbbrev,
      status: p.status,
      injured: entry.lineupSlotId === IR_SLOT || p.status === 'OUT' || p.status === 'INJURY_RESERVE',
      games: playsByDay.filter(Boolean).length,
      gamesLeft: week.days.filter((d, i) => playsByDay[i] && d.scoringPeriodId >= today).length,
      playsByDay,
    };
  });
  players.sort((a, b) => b.games - a.games || a.name.localeCompare(b.name));

  const healthy = players.filter((p) => !p.injured);
  const playingByDay = week.days.map((_, i) => healthy.filter((p) => p.playsByDay[i]).length);
  return {
    teamId: team.id,
    name: team.name,
    players,
    playingByDay,
    totalGames: healthy.reduce((sum, p) => sum + p.games, 0),
    usableGames: playingByDay.reduce((sum, n) => sum + Math.min(n, slots || n), 0),
    gamesLeft: healthy.reduce((sum, p) => sum + p.gamesLeft, 0),
  };
}

/** Games this matchup week for my team and my opponent. */
export function compareMatchupGames(snapshot: LeagueSnapshot): MatchupGamesComparison | undefined {
  const week = snapshot.matchupWeek;
  const me = snapshot.teams.find((t) => t.id === snapshot.myTeamId);
  if (!week || !me) return undefined;

  const matchup = snapshot.matchups.find((m) => m.isMyMatchup && m.week === snapshot.week);
  const opponentId = matchup && (matchup.homeTeamId === me.id ? matchup.awayTeamId : matchup.homeTeamId);
  const opponent = snapshot.teams.find((t) => t.id === opponentId);
  const slots = snapshot.startingSlots ?? 0;

  return {
    week: snapshot.week,
    days: week.days,
    today: snapshot.scoringPeriodId,
    startingSlots: slots,
    me: sideGames(me, week, snapshot.scoringPeriodId, slots),
    opponent: opponent && sideGames(opponent, week, snapshot.scoringPeriodId, slots),
  };
}
