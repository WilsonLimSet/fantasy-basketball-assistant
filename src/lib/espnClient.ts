/**
 * ESPN Fantasy Basketball API Client
 * Server-only module for authenticated ESPN API access
 *
 * SECURITY: Cookies are never logged. All secrets are server-side only.
 */

import type {
  ESPNLeagueResponse,
  ESPNFreeAgentResponse,
  ESPNTeam,
  ESPNMatchup,
  ESPNLeagueSettings,
  ESPNProTeamSchedule,
} from '@/types/espn';

// ESPN API base URL
const ESPN_API_BASE = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba';

// Rate limiting config
const RATE_LIMIT = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

// ESPN view parameters for different data fetches
export const ESPN_VIEWS = {
  settings: 'mSettings',
  teams: 'mTeam',
  roster: 'mRoster',
  matchup: 'mMatchup',
  matchupScore: 'mMatchupScore',
  scoreboard: 'mScoreboard',
  schedule: 'mSchedule',
  status: 'mStatus',
  standings: 'mStandings',
  players: 'kona_player_info',
  pendingTransactions: 'mPendingTransactions',
  positionAgainstOpponent: 'kona_playercard',
} as const;

interface ESPNClientConfig {
  leagueId: string;
  seasonId: number;
  espnS2: string;
  swid: string;
}

interface FetchOptions {
  views?: string[];
  scoringPeriodId?: number;
  matchupPeriodId?: number;
  params?: Record<string, string>;
}

function getConfig(): ESPNClientConfig {
  const leagueId = process.env.ESPN_LEAGUE_ID;
  const seasonId = parseInt(process.env.ESPN_SEASON || '2026', 10);
  const espnS2 = process.env.ESPN_S2;
  const swid = process.env.ESPN_SWID;

  if (!leagueId) {
    throw new Error('ESPN_LEAGUE_ID environment variable is required');
  }
  if (!espnS2) {
    throw new Error('ESPN_S2 environment variable is required');
  }
  if (!swid) {
    throw new Error('ESPN_SWID environment variable is required');
  }

  return { leagueId, seasonId, espnS2, swid };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = RATE_LIMIT.maxRetries
): Promise<Response> {
  let lastError: Error | null = null;
  let delay = RATE_LIMIT.baseDelayMs;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.status === 429) {
        // Rate limited - back off
        console.warn(`ESPN API rate limited. Waiting ${delay}ms before retry...`);
        await sleep(delay);
        delay = Math.min(delay * 2, RATE_LIMIT.maxDelayMs);
        continue;
      }

      if (!response.ok) {
        const text = await response.text().catch(() => 'No response body');
        throw new Error(`ESPN API error ${response.status}: ${text.substring(0, 200)}`);
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < retries) {
        console.warn(`ESPN API fetch failed (attempt ${attempt + 1}/${retries + 1}): ${lastError.message}`);
        await sleep(delay);
        delay = Math.min(delay * 2, RATE_LIMIT.maxDelayMs);
      }
    }
  }

  throw lastError || new Error('Failed to fetch from ESPN API');
}

async function espnFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const config = getConfig();

  // Build URL with views and params
  const url = new URL(`${ESPN_API_BASE}/seasons/${config.seasonId}/segments/0/leagues/${config.leagueId}`);

  // Add views
  if (options.views && options.views.length > 0) {
    options.views.forEach((view) => url.searchParams.append('view', view));
  }

  // Add scoring period
  if (options.scoringPeriodId !== undefined) {
    url.searchParams.set('scoringPeriodId', String(options.scoringPeriodId));
  }

  // Add matchup period
  if (options.matchupPeriodId !== undefined) {
    url.searchParams.set('matchupPeriodId', String(options.matchupPeriodId));
  }

  // Add additional params
  if (options.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  // SECURITY: Cookies are constructed here but never logged
  const response = await fetchWithRetry(url.toString(), {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Cookie': `espn_s2=${config.espnS2}; SWID=${config.swid}`,
    },
    cache: 'no-store',
  });

  return response.json() as Promise<T>;
}

async function espnFetchFreeAgents(options: {
  limit?: number;
  scoringPeriodId?: number;
  filter?: Record<string, unknown>;
}): Promise<ESPNFreeAgentResponse> {
  const config = getConfig();
  const limit = options.limit || 50;

  const url = new URL(`${ESPN_API_BASE}/seasons/${config.seasonId}/segments/0/leagues/${config.leagueId}`);
  url.searchParams.set('view', 'kona_player_info');

  if (options.scoringPeriodId !== undefined) {
    url.searchParams.set('scoringPeriodId', String(options.scoringPeriodId));
  }

  // Build filter for free agents
  const filter = {
    players: {
      filterStatus: {
        value: ['FREEAGENT', 'WAIVERS'],
      },
      filterSlotIds: {
        value: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      },
      sortPercOwned: {
        sortAsc: false,
        sortPriority: 1,
      },
      limit: limit,
      offset: 0,
      ...(options.filter || {}),
    },
  };

  const response = await fetchWithRetry(url.toString(), {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Cookie': `espn_s2=${config.espnS2}; SWID=${config.swid}`,
      'x-fantasy-filter': JSON.stringify(filter),
    },
    cache: 'no-store',
  });

  return response.json() as Promise<ESPNFreeAgentResponse>;
}

// ============ Public API Functions ============

/**
 * Get league settings including scoring rules, roster settings, etc.
 */
export async function getLeagueSettings(): Promise<ESPNLeagueSettings> {
  const response = await espnFetch<ESPNLeagueResponse>('', {
    views: [ESPN_VIEWS.settings, ESPN_VIEWS.status],
  });

  return {
    id: response.id,
    scoringPeriodId: response.scoringPeriodId,
    currentMatchupPeriod: response.status?.currentMatchupPeriod || 1,
    seasonId: response.seasonId,
    name: '', // Will be populated from teams
    size: response.settings?.rosterSettings?.lineupSlotCounts ? 8 : 8, // Default to 8
    status: response.status!,
    settings: response.settings!,
  };
}

/**
 * Get all teams in the league
 */
export async function getLeagueTeams(): Promise<ESPNTeam[]> {
  const response = await espnFetch<ESPNLeagueResponse>('', {
    views: [ESPN_VIEWS.teams, ESPN_VIEWS.standings],
  });

  return response.teams || [];
}

/**
 * Get rosters for all teams
 */
export async function getLeagueRosters(scoringPeriodId?: number): Promise<ESPNTeam[]> {
  const response = await espnFetch<ESPNLeagueResponse>('', {
    views: [ESPN_VIEWS.roster, ESPN_VIEWS.teams],
    scoringPeriodId,
  });

  return response.teams || [];
}

/**
 * Get matchups for a specific week
 */
export async function getMatchups(week?: number): Promise<ESPNMatchup[]> {
  const options: FetchOptions = {
    views: [ESPN_VIEWS.matchup, ESPN_VIEWS.matchupScore],
  };

  if (week !== undefined) {
    options.matchupPeriodId = week;
  }

  const response = await espnFetch<ESPNLeagueResponse>('', options);
  return response.schedule || [];
}

/**
 * Get top free agents
 */
export async function getFreeAgents(params?: {
  limit?: number;
  scoringPeriodId?: number;
}): Promise<ESPNFreeAgentResponse> {
  return espnFetchFreeAgents({
    limit: params?.limit || 50,
    scoringPeriodId: params?.scoringPeriodId,
  });
}

/**
 * Get NBA pro team schedule from ESPN
 */
export async function getNBAProTeamSchedule(): Promise<Array<{
  id: number;
  abbrev: string;
  proGamesByScoringPeriod?: Record<string, Array<{ id: number; date: number }>>;
}>> {
  const config = getConfig();
  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/${config.seasonId}?view=proTeamSchedules_wl`;

  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cookie': `espn_s2=${config.espnS2}; SWID=${config.swid}`,
      },
      cache: 'no-store',
    });

    const data = await response.json();
    return data.settings?.proTeams || [];
  } catch (error) {
    console.error('Failed to fetch NBA schedule:', error);
    return [];
  }
}

/**
 * Get recent league transactions (adds/drops by other teams)
 */
export async function getRecentTransactions(): Promise<Array<{
  teamId: number;
  type: 'ADD' | 'DROP';
  playerId: number;
  timestamp: number;
}>> {
  try {
    const response = await espnFetch<{ transactions?: Array<{
      teamId: number;
      type: string;
      status: string;
      proposedDate: number;
      items?: Array<{
        playerId: number;
        type: string;
      }>;
    }> }>('', {
      views: ['mTransactions2'],
    });

    const transactions: Array<{
      teamId: number;
      type: 'ADD' | 'DROP';
      playerId: number;
      timestamp: number;
    }> = [];

    // Only look at recent transactions (last 24 hours)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    for (const tx of response.transactions || []) {
      if (tx.status !== 'EXECUTED') continue;
      if (tx.proposedDate < oneDayAgo) continue;
      if (tx.type !== 'FREEAGENT' && tx.type !== 'WAIVER') continue;

      for (const item of tx.items || []) {
        if (item.type === 'ADD' || item.type === 'DROP') {
          transactions.push({
            teamId: tx.teamId,
            type: item.type as 'ADD' | 'DROP',
            playerId: item.playerId,
            timestamp: tx.proposedDate,
          });
        }
      }
    }

    return transactions;
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    return [];
  }
}

/**
 * Get combined league snapshot with all necessary data including NBA schedule
 */
export async function getLeagueSnapshot(): Promise<{
  settings: ESPNLeagueSettings;
  teams: ESPNTeam[];
  matchups: ESPNMatchup[];
  freeAgents: ESPNFreeAgentResponse;
  nbaSchedule: Array<{
    id: number;
    abbrev: string;
    proGamesByScoringPeriod?: Record<string, Array<{ id: number; date: number }>>;
  }>;
  recentTransactions: Array<{
    teamId: number;
    type: 'ADD' | 'DROP';
    playerId: number;
    timestamp: number;
  }>;
}> {
  // Fetch settings first to get current scoring period
  const settings = await getLeagueSettings();
  const scoringPeriodId = settings.scoringPeriodId;

  // Fetch remaining data in parallel
  const [teams, matchups, freeAgents, nbaSchedule, recentTransactions] = await Promise.all([
    getLeagueRosters(scoringPeriodId),
    getMatchups(settings.currentMatchupPeriod),
    getFreeAgents({ limit: 50, scoringPeriodId }),
    getNBAProTeamSchedule(),
    getRecentTransactions(),
  ]);

  return {
    settings,
    teams,
    matchups,
    freeAgents,
    nbaSchedule,
    recentTransactions,
  };
}

/**
 * Get NBA team schedule data
 * @deprecated Use getNBAProTeamSchedule instead
 */
export async function getNBASchedule(): Promise<Record<number, ESPNProTeamSchedule>> {
  return {};
}

// ============ NBA Team Reference Data ============

export const NBA_TEAMS: Record<number, { abbrev: string; name: string }> = {
  1: { abbrev: 'ATL', name: 'Atlanta Hawks' },
  2: { abbrev: 'BOS', name: 'Boston Celtics' },
  3: { abbrev: 'NOP', name: 'New Orleans Pelicans' },
  4: { abbrev: 'CHI', name: 'Chicago Bulls' },
  5: { abbrev: 'CLE', name: 'Cleveland Cavaliers' },
  6: { abbrev: 'DAL', name: 'Dallas Mavericks' },
  7: { abbrev: 'DEN', name: 'Denver Nuggets' },
  8: { abbrev: 'DET', name: 'Detroit Pistons' },
  9: { abbrev: 'GSW', name: 'Golden State Warriors' },
  10: { abbrev: 'HOU', name: 'Houston Rockets' },
  11: { abbrev: 'IND', name: 'Indiana Pacers' },
  12: { abbrev: 'LAC', name: 'LA Clippers' },
  13: { abbrev: 'LAL', name: 'Los Angeles Lakers' },
  14: { abbrev: 'MIA', name: 'Miami Heat' },
  15: { abbrev: 'MIL', name: 'Milwaukee Bucks' },
  16: { abbrev: 'MIN', name: 'Minnesota Timberwolves' },
  17: { abbrev: 'BKN', name: 'Brooklyn Nets' },
  18: { abbrev: 'NYK', name: 'New York Knicks' },
  19: { abbrev: 'ORL', name: 'Orlando Magic' },
  20: { abbrev: 'PHI', name: 'Philadelphia 76ers' },
  21: { abbrev: 'PHX', name: 'Phoenix Suns' },
  22: { abbrev: 'POR', name: 'Portland Trail Blazers' },
  23: { abbrev: 'SAC', name: 'Sacramento Kings' },
  24: { abbrev: 'SAS', name: 'San Antonio Spurs' },
  25: { abbrev: 'OKC', name: 'Oklahoma City Thunder' },
  26: { abbrev: 'UTA', name: 'Utah Jazz' },
  27: { abbrev: 'WAS', name: 'Washington Wizards' },
  28: { abbrev: 'TOR', name: 'Toronto Raptors' },
  29: { abbrev: 'MEM', name: 'Memphis Grizzlies' },
  30: { abbrev: 'CHA', name: 'Charlotte Hornets' },
};
