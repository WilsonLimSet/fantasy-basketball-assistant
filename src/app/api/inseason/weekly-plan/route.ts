/**
 * API Route: /api/inseason/weekly-plan
 * Returns weekly streaming optimization plan
 */

import { NextResponse } from 'next/server';
import { requireLeague } from '@/lib/inseason/routeContext';
import { freshSnapshot } from '@/lib/inseason/refreshLeague';
import { generateWeeklyStreamingPlan, getWaiverRecommendations } from '@/lib/inseason/optimizer';
import { compareMatchupGames } from '@/lib/inseason/matchupGames';
import type { WeeklyStreamingPlan, NBATeamSchedule, WaiverRecommendation, MatchupGamesComparison, MatchupWeekSchedule } from '@/types';

export const dynamic = 'force-dynamic';

interface WeeklyPlanResponse {
  success: boolean;
  plan?: WeeklyStreamingPlan;
  scheduleIndex?: Record<number, NBATeamSchedule>;
  topPicksByGames?: WaiverRecommendation[];
  matchupGames?: MatchupGamesComparison;
  matchupWeek?: MatchupWeekSchedule;
  today?: number;
  snapshotAge?: number;
  error?: string;
}

export async function GET(request: Request) {
  const { ctx, error } = await requireLeague();
  if (error) return error;
  try {
    const { leagueId, seasonId } = ctx;

    // Parse query params
    const url = new URL(request.url);
    const addsPerWeek = parseInt(url.searchParams.get('adds') || '5', 10);

    const { storage } = ctx;

    // Get latest snapshot
    const snapshot = await freshSnapshot(ctx);
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
      matchupGames: compareMatchupGames(snapshot),
      matchupWeek: snapshot.matchupWeek,
      today: snapshot.scoringPeriodId,
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
