/**
 * NBA Schedule Integration
 * Fetches real NBA game schedule from ESPN
 */

import type { NBATeamSchedule } from '@/types';

const ESPN_SCHEDULE_URL = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons';

interface ESPNProTeam {
  id: number;
  abbrev: string;
  location: string;
  name: string;
  proGamesByScoringPeriod?: Record<string, Array<{
    id: number;
    date: number;
    awayProTeamId: number;
    homeProTeamId: number;
  }>>;
}

interface ESPNScheduleResponse {
  settings: {
    proTeams: ESPNProTeam[];
  };
}

/**
 * Fetch NBA schedule from ESPN
 */
export async function fetchNBASchedule(
  seasonId: number,
  espnS2: string,
  swid: string
): Promise<ESPNProTeam[]> {
  const url = `${ESPN_SCHEDULE_URL}/${seasonId}?view=proTeamSchedules_wl`;

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Cookie': `espn_s2=${espnS2}; SWID=${swid}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    console.error('Failed to fetch NBA schedule:', response.status);
    return [];
  }

  const data: ESPNScheduleResponse = await response.json();
  return data.settings?.proTeams || [];
}

/**
 * Build schedule index for all NBA teams
 * @param proTeams - ESPN pro teams with schedule data
 * @param currentScoringPeriod - Current ESPN scoring period ID
 * @param daysAhead - How many days to look ahead (default 7)
 */
export function buildNBAScheduleIndex(
  proTeams: ESPNProTeam[],
  currentScoringPeriod: number,
  daysAhead = 7
): Record<number, NBATeamSchedule> {
  const index: Record<number, NBATeamSchedule> = {};

  // Calculate scoring period range (each day is one scoring period in ESPN)
  const periodsToCheck: string[] = [];
  for (let i = 0; i < daysAhead; i++) {
    periodsToCheck.push(String(currentScoringPeriod + i));
  }

  // Also track games by date string for streaming planner
  const today = new Date();

  for (const team of proTeams) {
    if (!team.proGamesByScoringPeriod) continue;

    const gamesByDay: Record<string, boolean> = {};
    let gamesNext7Days = 0;
    let gamesThisWeek = 0;

    for (let i = 0; i < daysAhead; i++) {
      const periodId = String(currentScoringPeriod + i);
      const dateStr = new Date(today.getTime() + i * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const gamesOnDay = team.proGamesByScoringPeriod[periodId];
      if (gamesOnDay && gamesOnDay.length > 0) {
        gamesByDay[dateStr] = true;
        gamesNext7Days++;
        if (i < 7) gamesThisWeek++;
      } else {
        gamesByDay[dateStr] = false;
      }
    }

    index[team.id] = {
      teamId: team.id,
      teamAbbrev: team.abbrev,
      gamesThisWeek,
      gamesNext7Days,
      gamesByDay,
    };
  }

  return index;
}

/**
 * Get teams with the most games in the next 7 days
 */
export function getTopScheduleTeams(
  scheduleIndex: Record<number, NBATeamSchedule>,
  limit = 10
): NBATeamSchedule[] {
  return Object.values(scheduleIndex)
    .sort((a, b) => b.gamesNext7Days - a.gamesNext7Days)
    .slice(0, limit);
}

/**
 * Get teams with 4+ games this week (streaming targets)
 */
export function getFourGameTeams(
  scheduleIndex: Record<number, NBATeamSchedule>
): NBATeamSchedule[] {
  return Object.values(scheduleIndex)
    .filter((team) => team.gamesNext7Days >= 4)
    .sort((a, b) => b.gamesNext7Days - a.gamesNext7Days);
}

/**
 * Get teams with light schedules (2 or fewer games)
 */
export function getLightScheduleTeams(
  scheduleIndex: Record<number, NBATeamSchedule>
): NBATeamSchedule[] {
  return Object.values(scheduleIndex)
    .filter((team) => team.gamesNext7Days <= 2)
    .sort((a, b) => a.gamesNext7Days - b.gamesNext7Days);
}
