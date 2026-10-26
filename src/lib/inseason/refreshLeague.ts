/**
 * Refresh one league: fetch it from ESPN, store the snapshot, diff and injury history.
 * Shared by the cron (every connected league) and a user's "Refresh now".
 */

import { getLeagueSnapshot, withLeague } from './espnClient';
import { buildLeagueSnapshot, calculateSnapshotDiff } from './dataTransform';
import { saveProfile } from './profile';
import { updateInjuryHistory } from './injuryTracker';
import { injuryReport } from './stash';
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
  const [espnData, injuries] = await Promise.all([
    withLeague(ctx.espn, () => getLeagueSnapshot()),
    // Return dates tell a six-week absence from a two-game one; moves still work without them.
    injuryReport().catch((e) => {
      console.warn('[refreshLeague] injury report failed:', e instanceof Error ? e.message : e);
      return null;
    }),
  ]);
  const snapshot = buildLeagueSnapshot({
    settings: espnData.settings,
    teams: espnData.teams,
    matchups: espnData.matchups,
    freeAgents: espnData.freeAgents,
    nbaSchedule: espnData.nbaSchedule,
    myTeamId: ctx.myTeamId,
  });
  if (injuries) snapshot.injuries = Object.fromEntries([...injuries].map(([id, e]) => [id, { returnDate: e.returnDate }]));

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

/** Older than this, a page view reloads the league from ESPN (free) instead of waiting for the cron. */
export const VIEW_REFRESH_MS = 30 * 60 * 1000;

/** The stored snapshot, reloaded first when it's missing or older than maxAgeMs. */
export async function freshSnapshot(ctx: LeagueContext, maxAgeMs = VIEW_REFRESH_MS): Promise<LeagueSnapshot | null> {
  const snapshot = await ctx.storage.getLatestSnapshot(ctx.leagueId, ctx.seasonId);
  if (snapshot && Date.now() - snapshot.fetchedAt <= maxAgeMs) return snapshot;
  try {
    const fresh = (await refreshLeague(ctx)).snapshot;
    if (ctx.profile) await saveProfile({ ...ctx.profile, lastRefreshAt: Date.now() });
    return fresh;
  } catch (e) {
    console.error('[refreshLeague] view refresh failed', e);
    return snapshot;
  }
}
