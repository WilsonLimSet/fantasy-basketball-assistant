/**
 * API Route: /api/weekly-plan
 * Returns weekly streaming optimization plan
 */

import { NextResponse } from 'next/server';
import { createStorageAdapter } from '@/lib/storage';
import { generateWeeklyStreamingPlan, getWaiverRecommendations } from '@/lib/optimizer';
import type { WeeklyStreamingPlan, NBATeamSchedule, WaiverRecommendation } from '@/types';

export const dynamic = 'force-dynamic';

interface WeeklyPlanResponse {
  success: boolean;
  plan?: WeeklyStreamingPlan;
  scheduleIndex?: Record<number, NBATeamSchedule>;
  topPicksByGames?: WaiverRecommendation[];
  snapshotAge?: number;
  error?: string;
}

export async function GET(request: Request) {
  try {
    const leagueId = parseInt(process.env.ESPN_LEAGUE_ID || '0', 10);
    const seasonId = parseInt(process.env.ESPN_SEASON || '2026', 10);

    if (!leagueId) {
      return NextResponse.json(
        { success: false, error: 'ESPN_LEAGUE_ID not configured' },
        { status: 500 }
      );
    }

    // Parse query params
    const url = new URL(request.url);
    const addsPerWeek = parseInt(url.searchParams.get('adds') || '5', 10);

    const storage = await createStorageAdapter();

    // Get latest snapshot
    const snapshot = await storage.getLatestSnapshot(leagueId, seasonId);
    if (!snapshot) {
      return NextResponse.json(
        {
          success: false,
          error: 'No snapshot available. Please run a refresh first.',
        },
        { status: 404 }
      );
    }

    // Generate weekly streaming plan
    const plan = generateWeeklyStreamingPlan(snapshot, addsPerWeek);

    // Get injury history for risk assessment
    const injuryHistory = await storage.getInjuryHistory(leagueId, seasonId);

    // Get waiver recommendations with injury history and filter for players on 4-game teams
    const allRecommendations = getWaiverRecommendations(snapshot, 50, injuryHistory);
    const topPicksByGames = allRecommendations.filter((rec) => rec.gamesNext7 >= 4);

    // Calculate snapshot age
    const snapshotAge = Date.now() - snapshot.fetchedAt;

    const response: WeeklyPlanResponse = {
      success: true,
      plan,
      scheduleIndex: snapshot.scheduleIndex,
      topPicksByGames,
      snapshotAge,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Weekly Plan] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
