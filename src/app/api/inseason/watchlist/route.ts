/**
 * API Route: /api/inseason/watchlist
 * Manage watchlist of players to track for opportunities
 */

import { NextResponse } from 'next/server';
import { requireLeague } from '@/lib/inseason/routeContext';
import { freshWatchlist } from '@/lib/inseason/watchlist';
import type { Watchlist } from '@/types';

export const dynamic = 'force-dynamic';

interface WatchlistResponse {
  success: boolean;
  watchlist?: Watchlist;
  error?: string;
}

// GET - Get current watchlist
export async function GET() {
  const { ctx, error } = await requireLeague();
  if (error) return error;
  try {
    const { leagueId, seasonId } = ctx;

    // Read the ESPN watchlist now, so starring a player in the ESPN app shows up right away.
    const watchlist = await freshWatchlist(ctx).catch(() => ctx.storage.getWatchlist(leagueId, seasonId));

    return NextResponse.json({
      success: true,
      watchlist: watchlist || { playerIds: [], lastUpdated: Date.now() },
    });
  } catch (error) {
    console.error('[Watchlist] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST - Add player to watchlist
export async function POST(request: Request) {
  const { ctx, error } = await requireLeague();
  if (error) return error;
  try {
    const { leagueId, seasonId } = ctx;

    const body = await request.json();
    const { playerId } = body;

    if (!playerId || typeof playerId !== 'number') {
      return NextResponse.json(
        { success: false, error: 'playerId is required and must be a number' },
        { status: 400 }
      );
    }

    const { storage } = ctx;
    const existing = await storage.getWatchlist(leagueId, seasonId);
    const watchlist: Watchlist = existing || { playerIds: [], lastUpdated: Date.now() };

    // Add if not already in list
    if (!watchlist.playerIds.includes(playerId)) {
      watchlist.playerIds.push(playerId);
      // Added here: keep it even if it's not on the ESPN watchlist.
      watchlist.appIds = [...new Set([...(watchlist.appIds ?? []), playerId])];
      watchlist.lastUpdated = Date.now();
      await storage.storeWatchlist(leagueId, seasonId, watchlist);
    }

    return NextResponse.json({ success: true, watchlist });
  } catch (error) {
    console.error('[Watchlist] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// DELETE - Remove player from watchlist
export async function DELETE(request: Request) {
  const { ctx, error } = await requireLeague();
  if (error) return error;
  try {
    const { leagueId, seasonId } = ctx;

    const url = new URL(request.url);
    const playerId = parseInt(url.searchParams.get('playerId') || '0', 10);

    if (!playerId) {
      return NextResponse.json(
        { success: false, error: 'playerId query param is required' },
        { status: 400 }
      );
    }

    const { storage } = ctx;
    const existing = await storage.getWatchlist(leagueId, seasonId);

    if (!existing) {
      return NextResponse.json({
        success: true,
        watchlist: { playerIds: [], lastUpdated: Date.now() },
      });
    }

    const onEspn = (existing.espnIds ?? []).includes(playerId);
    const watchlist: Watchlist = {
      playerIds: existing.playerIds.filter(id => id !== playerId),
      appIds: (existing.appIds ?? []).filter(id => id !== playerId),
      espnIds: existing.espnIds,
      // Still starred in ESPN: hide him here until he's un-starred there.
      hiddenIds: onEspn ? [...new Set([...(existing.hiddenIds ?? []), playerId])] : existing.hiddenIds,
      lastUpdated: Date.now(),
    };

    await storage.storeWatchlist(leagueId, seasonId, watchlist);

    return NextResponse.json({ success: true, watchlist });
  } catch (error) {
    console.error('[Watchlist] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
