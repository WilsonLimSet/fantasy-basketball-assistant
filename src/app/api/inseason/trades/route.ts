/**
 * API Route: /api/inseason/trades
 * Trade ideas for your league (paid): league mates' players in a slump to buy low, yours running
 * hot to sell high, and offers that win on the value model while looking fair on recent box scores.
 */

import { NextResponse } from 'next/server';
import { requireLeague } from '@/lib/inseason/routeContext';
import { freshSnapshot } from '@/lib/inseason/refreshLeague';
import { findTrades } from '@/lib/trades';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const { ctx, error } = await requireLeague();
  if (error) return error;
  try {
    const snapshot = await freshSnapshot(ctx);
    if (!snapshot) return NextResponse.json({ success: false, error: 'No league data yet. Hit Refresh on This week to load it.' }, { status: 404 });
    const found = await findTrades(snapshot);
    return NextResponse.json({ success: true, leagueId: ctx.leagueId, seasonId: ctx.seasonId, ...found });
  } catch (e) {
    console.error('[trades]', e);
    return NextResponse.json({ success: false, error: 'Could not build trade ideas. Try again in a minute.' }, { status: 502 });
  }
}
