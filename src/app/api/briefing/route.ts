/**
 * API Route: /api/briefing
 * Returns daily team briefing with status changes, recommendations, and action items
 */

import { NextResponse } from 'next/server';
import { createStorageAdapter } from '@/lib/storage';
import { generateDailyBriefing } from '@/lib/optimizer';
import type { DailyBriefing } from '@/types';

export const dynamic = 'force-dynamic';

interface BriefingResponse {
  success: boolean;
  briefing?: DailyBriefing;
  snapshotAge?: number;
  error?: string;
}

export async function GET() {
  try {
    const leagueId = parseInt(process.env.ESPN_LEAGUE_ID || '0', 10);
    const seasonId = parseInt(process.env.ESPN_SEASON || '2026', 10);

    if (!leagueId) {
      return NextResponse.json(
        { success: false, error: 'ESPN_LEAGUE_ID not configured' },
        { status: 500 }
      );
    }

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

    // Get last diff for status changes
    const lastDiff = await storage.getLastDiff(leagueId, seasonId);
    const statusChanges = lastDiff?.statusChanges || [];

    // Generate briefing
    const briefing = generateDailyBriefing(snapshot, statusChanges);

    // Calculate snapshot age
    const snapshotAge = Date.now() - snapshot.fetchedAt;

    const response: BriefingResponse = {
      success: true,
      briefing,
      snapshotAge,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Briefing] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
