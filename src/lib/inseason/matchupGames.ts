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

/**
 * Days of the current matchup week and which of them each NBA team plays.
 * Uses the league's matchup period mapping. Before the season ESPN maps every matchup period to a
 * single day, so in that case the week runs from today through Sunday (ESPN weeks end on Sunday).
 */
export function buildMatchupWeek(
  nbaSchedule: Array<{ id: number; proGamesByScoringPeriod?: Record<string, Array<{ date: number }>> }>,
  matchupPeriods: Record<string, number[]> | undefined,
  currentMatchupPeriod: number,
  currentScoringPeriod: number
): MatchupWeekSchedule | undefined {
  // Find the date of one scoring period; the rest follow a day apart.
  let anchor: { period: number; date: string } | undefined;
  for (const team of nbaSchedule) {
    for (const [period, games] of Object.entries(team.proGamesByScoringPeriod ?? {})) {
      if (games[0]) {
        anchor = { period: Number(period), date: easternDate(games[0].date) };
        break;
      }
    }
    if (anchor) break;
  }
  if (!anchor) return undefined;
  const anchorMs = Date.parse(`${anchor.date}T12:00:00Z`);
  const dateOf = (period: number) => new Date(anchorMs + (period - anchor!.period) * DAY_MS).toISOString().slice(0, 10);

  let periods = matchupPeriods?.[String(currentMatchupPeriod)] ?? [];
  if (periods.length <= 1) {
    const dow = new Date(`${dateOf(currentScoringPeriod)}T12:00:00Z`).getUTCDay(); // 0 = Sunday
    const daysToSunday = (7 - dow) % 7;
    periods = Array.from({ length: daysToSunday + 1 }, (_, i) => currentScoringPeriod + i);
  }

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
