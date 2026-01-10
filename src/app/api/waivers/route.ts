/**
 * API Route: /api/waivers
 * Returns ranked waiver wire recommendations
 */

import { NextResponse } from 'next/server';
import { createStorageAdapter } from '@/lib/storage';
import { getWaiverRecommendations, getDropRecommendations } from '@/lib/optimizer';
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
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);

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
