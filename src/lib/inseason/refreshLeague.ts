/**
 * Refresh one league: fetch it from ESPN, store the snapshot, diff and injury history.
 * Shared by the cron (every connected league) and a user's "Refresh now".
 */

import { getLeagueSnapshot, withLeague } from './espnClient';
import { buildLeagueSnapshot, calculateSnapshotDiff } from './dataTransform';
import { updateInjuryHistory } from './injuryTracker';
import type { LeagueContext } from './profile';
import type { LeagueSnapshot, LeagueTransaction, SnapshotDiff, Watchlist } from '@/types';

export interface RefreshedLeague {
  snapshot: LeagueSnapshot;
  diff: SnapshotDiff;
  /** The user's ESPN watchlist. */
  watchlist: Watchlist | null;
  transactions: LeagueTransaction[];
}

export async function refreshLeague(ctx: LeagueContext): Promise<RefreshedLeague> {
  const espnData = await withLeague(ctx.espn, () => getLeagueSnapshot());
  const snapshot = buildLeagueSnapshot({
    settings: espnData.settings,
    teams: espnData.teams,
    matchups: espnData.matchups,
    freeAgents: espnData.freeAgents,
    nbaSchedule: espnData.nbaSchedule,
    myTeamId: ctx.myTeamId,
  });

  const { storage, leagueId, seasonId } = ctx;
  const previous = await storage.getLatestSnapshot(leagueId, seasonId);
  const diff = calculateSnapshotDiff(previous, snapshot);
  await storage.storeSnapshot(snapshot);
  await storage.storeLastDiff(leagueId, seasonId, diff);

  const history = updateInjuryHistory(snapshot, await storage.getInjuryHistory(leagueId, seasonId));
  await storage.storeInjuryHistory(leagueId, seasonId, history);

  // The ESPN watchlist syncs on every refresh, so players starred in the ESPN app show up here.
  const watchIds = espnData.teams.find((t) => t.id === ctx.myTeamId)?.watchList ?? [];
  const saved = await storage.getWatchlist(leagueId, seasonId);
  const ids = [...new Set([...(saved?.playerIds ?? []), ...watchIds])];
  const watchlist = ids.length ? { playerIds: ids, lastUpdated: Date.now() } : null;
  if (watchlist && ids.length !== (saved?.playerIds.length ?? 0)) await storage.storeWatchlist(leagueId, seasonId, watchlist);

  const transactions: LeagueTransaction[] = (espnData.recentTransactions || []).map((tx) => ({
    teamId: tx.teamId,
    type: tx.type,
    playerId: tx.playerId,
    playerName: tx.playerName,
    playerSeasonAvg: tx.playerSeasonAvg,
    playerTeamAbbrev: tx.playerTeamAbbrev,
    timestamp: tx.timestamp,
  }));

  return { snapshot, diff, watchlist, transactions };
}
