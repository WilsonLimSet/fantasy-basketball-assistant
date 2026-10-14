/**
 * API Route: /api/inseason/briefing
 * Returns daily team briefing with status changes, recommendations, and action items
 */

import { NextResponse } from 'next/server';
import { requireLeague } from '@/lib/inseason/routeContext';
import { generateDailyBriefing } from '@/lib/inseason/optimizer';
import type { DailyBriefing } from '@/types';

export const dynamic = 'force-dynamic';

interface BriefingResponse {
  success: boolean;
  briefing?: DailyBriefing;
  snapshotAge?: number;
  error?: string;
}

export async function GET() {
  const { ctx, error } = await requireLeague();
  if (error) return error;
  try {
    const { leagueId, seasonId } = ctx;

    const { storage } = ctx;

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
