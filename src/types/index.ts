// Internal Data Models

import type { PlayerStatus } from './espn';

export * from './espn';

// Normalized player representation
export interface Player {
  id: number;
  name: string;
  firstName: string;
  lastName: string;
  nbaTeamId: number;
  nbaTeamAbbrev?: string;
  positions: string[];
  eligibleSlots: number[];
  status: PlayerStatus;
  injuryNote?: string;
  ownership?: {
    percentOwned: number;
    percentChange: number;
    percentStarted: number;
  };
  stats?: PlayerSeasonStats;
}

export interface PlayerSeasonStats {
  seasonAvg?: number;
  projectedAvg?: number;
  projectedTotal?: number;
  last7Avg?: number;
  last15Avg?: number;
  last30Avg?: number;
  gamesPlayed?: number;
}

// Roster entry with player details
export interface RosterEntry {
  playerId: number;
  player: Player;
  lineupSlot: string;
  lineupSlotId: number;
  acquisitionDate: number;
  appliedTotal?: number;
}

// Team with roster
export interface Team {
  id: number;
  abbrev: string;
  name: string;
  nickname?: string;
  isMyTeam: boolean;
  owners?: string[];
  record?: {
    wins: number;
    losses: number;
    ties: number;
    pointsFor: number;
    pointsAgainst: number;
  };
  roster?: RosterEntry[];
}

// Free agent entry
export interface FreeAgentEntry {
  player: Player;
  score: number;
  projectedPointsNext7?: number;
  gamesNext7?: number;
  recentTrend?: number;
  reasonCodes: string[];
}

// Matchup info
export interface Matchup {
  id: number;
  week: number;
  homeTeamId: number;
  awayTeamId?: number;
  homePoints: number;
  awayPoints?: number;
  isMyMatchup: boolean;
}

// NBA Schedule info
export interface NBATeamSchedule {
  teamId: number;
  teamAbbrev: string;
  gamesThisWeek: number;
  gamesNext7Days: number;
  gamesByDay: Record<string, boolean>; // date string -> has game
}

// Status change tracking
export interface StatusChange {
  playerId: number;
  playerName: string;
  previousStatus: PlayerStatus;
  currentStatus: PlayerStatus;
  isMyPlayer: boolean;
  injuryNote?: string;
  timestamp: number;
}

// Waiver recommendation
export interface WaiverRecommendation {
  rank: number;
  player: Player;
  score: number;
  projectedPointsNext7: number;
  gamesNext7: number;
  recentTrend: number;
  reasons: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

// Streaming plan entry
export interface StreamingSlot {
  date: string;
  dayOfWeek: string;
  recommendedAdd?: Player;
  recommendedDrop?: Player;
  reason: string;
  gamesGained: number;
}

export interface WeeklyStreamingPlan {
  week: number;
  weekStartDate: string;
  weekEndDate: string;
  totalGamesWithStreaming: number;
  totalGamesWithoutStreaming: number;
  gamesGained: number;
  addsRemaining: number;
  addsUsed: number;
  plan: StreamingSlot[];
}

// Injury opportunity
export interface InjuryOpportunity {
  injuredPlayer: Player;
  injuryStatus: PlayerStatus;
  injuryNote?: string;
  beneficiaries: Array<{
    player: Player;
    score: number;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    reasons: string[];
  }>;
  timestamp: number;
}

// Daily briefing
export interface DailyBriefing {
  generatedAt: number;
  week: number;
  myTeam: Team;
  statusChanges: StatusChange[];
  upcomingGames: Array<{
    player: Player;
    nextGameDate?: string;
    opponent?: string;
  }>;
  actionItems: string[];
  topWaiverAdds: WaiverRecommendation[];
  injuryOpportunities: InjuryOpportunity[];
  diffSummary: string[];
}

// League snapshot for persistence
export interface LeagueSnapshot {
  fetchedAt: number;
  leagueId: number;
  seasonId: number;
  week: number;
  scoringPeriodId: number;
  teams: Team[];
  myTeamId: number;
  matchups: Matchup[];
  freeAgentsTopN: FreeAgentEntry[];
  statusIndex: Record<number, { status: PlayerStatus; injuryNote?: string }>;
  scheduleIndex: Record<number, NBATeamSchedule>;
}

// Snapshot diff
export interface SnapshotDiff {
  statusChanges: StatusChange[];
  newTopWaiverCandidates: FreeAgentEntry[];
  removedTopWaiverCandidates: FreeAgentEntry[];
  weekChanged: boolean;
  significantChanges: boolean;
}

// Telegram message types
export type AlertType =
  | 'STATUS_CHANGE'
  | 'WAIVER_ALERT'
  | 'INJURY_OPPORTUNITY'
  | 'WEEKLY_PLAN_UPDATE'
  | 'DAILY_BRIEFING';

export interface TelegramAlert {
  type: AlertType;
  title: string;
  message: string;
  timestamp: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

// Injury History Tracking
export interface InjuryEvent {
  startDate: number;      // timestamp when injury started
  endDate?: number;       // timestamp when returned (undefined if still injured)
  status: PlayerStatus;   // OUT, IR, DTD, etc.
  note?: string;          // injury description
  gamesMissed: number;    // estimated games missed during this injury
}

export interface PlayerInjuryHistory {
  playerId: number;
  playerName: string;
  nbaTeamId: number;
  totalGamesMissed: number;       // total games missed this season
  totalGamesTracked: number;      // total games we've been tracking
  injuryEvents: InjuryEvent[];    // list of injury periods
  currentlyInjured: boolean;
  lastUpdated: number;
}

// Index of all players' injury histories
export type InjuryHistoryIndex = Record<number, PlayerInjuryHistory>;

// Injury risk assessment for waiver recommendations
export interface InjuryRiskAssessment {
  playerId: number;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  gamesMissedPct: number;         // % of games missed
  injuryCount: number;            // number of separate injury events
  isCurrentlyInjured: boolean;
  scorePenalty: number;           // multiplier (0.5-1.0) to apply to waiver score
}

// Watchlist for tracking players of interest
export interface Watchlist {
  playerIds: number[];
  lastUpdated: number;
}

// Smart alert types for actionable notifications
export type SmartAlertType =
  | 'ROSTER_INJURY'           // Your player got injured
  | 'ROSTER_RETURN'           // Your player returned from injury
  | 'TEAMMATE_INJURY'         // Key teammate of your player is out (usage boost)
  | 'TEAMMATE_RETURN'         // Key teammate of your player is back (usage threat)
  | 'WATCHLIST_OPPORTUNITY'   // Key teammate of watchlist player is out
  | 'HOT_WAIVER_ADD'          // High-value waiver add available
  | 'WEEKLY_SUMMARY';         // Periodic summary

export interface SmartAlert {
  type: SmartAlertType;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  playerName?: string;
  teamAbbrev?: string;
  details: string;
  action?: string;              // Recommended action (e.g., "Add X, Drop Y")
  relatedPlayers?: string[];    // Players that benefit/are affected
  timestamp: number;
}

// Teammate usage opportunity when star is injured
export interface UsageOpportunity {
  injuredStar: Player;
  injuryStatus: PlayerStatus;
  beneficiaries: Array<{
    player: Player;
    isOnMyRoster: boolean;
    isOnWatchlist: boolean;
    usageBoostReason: string;
  }>;
}

// League transaction (add/drop by other teams)
export interface LeagueTransaction {
  teamId: number;
  teamName?: string;
  type: 'ADD' | 'DROP' | 'TRADE';
  playerId: number;
  playerName?: string;
  playerSeasonAvg?: number;
  playerTeamAbbrev?: string;
  timestamp: number;
}
