/**
 * API Route: /api/refresh
 * Fetches latest ESPN data, computes diff, stores snapshot, sends alerts
 * Used by Vercel Cron (every 6 hours) and manual refresh
 */

import { NextResponse } from 'next/server';
import { getLeagueSnapshot } from '@/lib/espnClient';
import { buildLeagueSnapshot, calculateSnapshotDiff } from '@/lib/dataTransform';
import { createStorageAdapter } from '@/lib/storage';
import { sendSmartAlerts } from '@/lib/telegram';
import { updateInjuryHistory } from '@/lib/injuryTracker';
import { generateSmartAlerts, hasActionableAlerts } from '@/lib/smartAlerts';
import type { SnapshotDiff, LeagueTransaction } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds for this route

interface RefreshResult {
  success: boolean;
  fetchedAt: number;
  leagueId: number;
  week: number;
  diff: SnapshotDiff | null;
  alertSent: boolean;
  error?: string;
}

export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    // Simple auth: allow manual refresh, cron with secret, or no secret configured
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isManualRefresh = request.headers.get('x-manual-refresh') === 'true';

    // Only enforce auth if CRON_SECRET is set and this isn't a manual refresh
    if (cronSecret && !isManualRefresh && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get league configuration
    const leagueId = parseInt(process.env.ESPN_LEAGUE_ID || '0', 10);
    const seasonId = parseInt(process.env.ESPN_SEASON || '2026', 10);

    if (!leagueId) {
      return NextResponse.json(
        { error: 'ESPN_LEAGUE_ID not configured' },
        { status: 500 }
      );
    }

    // Determine my team ID (from env or first team as fallback)
    const myTeamId = parseInt(process.env.ESPN_MY_TEAM_ID || '1', 10);

    console.log(`[Refresh] Starting refresh for league ${leagueId}, season ${seasonId}`);

    // Fetch latest data from ESPN (includes NBA schedule)
    const espnData = await getLeagueSnapshot();
    console.log(`[Refresh] ESPN data fetched in ${Date.now() - startTime}ms`);
    console.log(`[Refresh] NBA schedule: ${espnData.nbaSchedule?.length || 0} teams`);

    // Build normalized snapshot with real schedule data
    const snapshot = buildLeagueSnapshot({
      settings: espnData.settings,
      teams: espnData.teams,
      matchups: espnData.matchups,
      freeAgents: espnData.freeAgents,
      nbaSchedule: espnData.nbaSchedule,
      myTeamId,
    });

    // Get storage adapter
    const storage = await createStorageAdapter();

    // Get previous snapshot for diff
    const previousSnapshot = await storage.getLatestSnapshot(leagueId, seasonId);

    // Calculate diff
    const diff = calculateSnapshotDiff(previousSnapshot, snapshot);

    // Store new snapshot
    await storage.storeSnapshot(snapshot);
    await storage.storeLastDiff(leagueId, seasonId, diff);

    // Update injury history tracking
    const previousInjuryHistory = await storage.getInjuryHistory(leagueId, seasonId);
    const updatedInjuryHistory = updateInjuryHistory(snapshot, previousInjuryHistory);
    await storage.storeInjuryHistory(leagueId, seasonId, updatedInjuryHistory);

    const injuredCount = Object.values(updatedInjuryHistory).filter(h => h.currentlyInjured).length;
    console.log(`[Refresh] Injury history updated. ${injuredCount} players currently injured`);

    console.log(`[Refresh] Snapshot stored. Significant changes: ${diff.significantChanges}`);

    // Get ESPN watchlist from the team data (synced automatically!)
    const myEspnTeam = espnData.teams.find(t => t.id === myTeamId);
    const espnWatchlistIds = myEspnTeam?.watchList || [];
    const watchlist = espnWatchlistIds.length > 0
      ? { playerIds: espnWatchlistIds, lastUpdated: Date.now() }
      : null;

    console.log(`[Refresh] ESPN Watchlist: ${espnWatchlistIds.length} players`);

    // Convert recent transactions to the expected format (now enriched with player info)
    const leagueTransactions: LeagueTransaction[] = (espnData.recentTransactions || []).map(tx => ({
      teamId: tx.teamId,
      type: tx.type,
      playerId: tx.playerId,
      playerName: tx.playerName,
      playerSeasonAvg: tx.playerSeasonAvg,
      playerTeamAbbrev: tx.playerTeamAbbrev,
      timestamp: tx.timestamp,
    }));

    console.log(`[Refresh] Recent transactions: ${leagueTransactions.length}`);

    const smartAlerts = generateSmartAlerts(snapshot, diff, watchlist, leagueTransactions);

    console.log(`[Refresh] Generated ${smartAlerts.length} smart alerts`);

    // Log alert details for debugging (useful when Telegram is down)
    for (const alert of smartAlerts) {
      console.log(`[Alert] ${alert.priority} - ${alert.title}: ${alert.details}`)
    }

    // Send Telegram alerts only if there are actionable ones
    let alertSent = false;
    try {
      if (hasActionableAlerts(smartAlerts)) {
        alertSent = await sendSmartAlerts(smartAlerts, snapshot.week);
        console.log(`[Refresh] Smart alerts sent: ${alertSent}`);
      }
    } catch (alertError) {
      console.error('[Refresh] Failed to send alert:', alertError);
    }

    const result: RefreshResult = {
      success: true,
      fetchedAt: snapshot.fetchedAt,
      leagueId: snapshot.leagueId,
      week: snapshot.week,
      diff,
      alertSent,
    };

    console.log(`[Refresh] Complete in ${Date.now() - startTime}ms`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Refresh] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        fetchedAt: Date.now(),
        leagueId: 0,
        week: 0,
        diff: null,
        alertSent: false,
      } satisfies RefreshResult,
      { status: 500 }
    );
  }
}

// POST also supported for manual refresh
export async function POST(request: Request) {
  // Add manual refresh header
  const headers = new Headers(request.headers);
  headers.set('x-manual-refresh', 'true');

  return GET(new Request(request.url, { headers }));
}
