/**
 * API Route: /api/inseason/waivers
 * Returns ranked waiver wire recommendations
 */

import { NextResponse } from 'next/server';
import { requireLeague } from '@/lib/inseason/routeContext';
import { freshSnapshot } from '@/lib/inseason/refreshLeague';
import { getWaiverRecommendations, getDropRecommendations } from '@/lib/inseason/optimizer';
import type { WaiverRecommendation, Player } from '@/types';

export const dynamic = 'force-dynamic';

interface WaiversResponse {
  success: boolean;
  week?: number;
  recommendations?: WaiverRecommendation[];
  dropCandidates?: Array<{ player: Player; reasons: string[] }>;
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
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);

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

    // Get injury history for risk assessment
    const injuryHistory = await storage.getInjuryHistory(leagueId, seasonId);

    // Get waiver recommendations with injury history
    const recommendations = getWaiverRecommendations(snapshot, limit, injuryHistory);

    // Get drop recommendations
    const dropCandidates = getDropRecommendations(snapshot, 5);

    // Calculate snapshot age
    const snapshotAge = Date.now() - snapshot.fetchedAt;

    const response: WaiversResponse = {
      success: true,
      week: snapshot.week,
      recommendations,
      dropCandidates,
      snapshotAge,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Waivers] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
