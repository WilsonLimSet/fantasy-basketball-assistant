/**
 * API Route: /api/inseason/trades
 * GET: trade ideas for your league (paid): league mates' players in a slump to buy low, yours
 * worth more to others than to you to sell high, and offers that win on the value model while
 * looking fair on recent box scores. POST { block: number[] }: save your trade block (the players
 * you're open to trading; offers only send these).
 */

import { NextResponse } from 'next/server';
import { requireLeague } from '@/lib/inseason/routeContext';
import { freshSnapshot } from '@/lib/inseason/refreshLeague';
import { kvStore } from '@/lib/inseason/storage';
import type { LeagueContext } from '@/lib/inseason/profile';
import { findTrades } from '@/lib/trades';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const blockKey = (ctx: LeagueContext) => `trades:block:${(ctx.email || 'guest').toLowerCase()}:${ctx.leagueId}:${ctx.seasonId}`;

export async function GET() {
  const { ctx, error } = await requireLeague();
  if (error) return error;
  try {
    const [snapshot, block] = await Promise.all([freshSnapshot(ctx), kvStore().get<number[]>(blockKey(ctx)).catch(() => null)]);
    if (!snapshot) return NextResponse.json({ success: false, error: 'No league data yet. Hit Refresh on This week to load it.' }, { status: 404 });
    const found = await findTrades(snapshot, block ?? []);
    return NextResponse.json({ success: true, leagueId: ctx.leagueId, seasonId: ctx.seasonId, block: block ?? [], ...found });
  } catch (e) {
    console.error('[trades]', e);
    return NextResponse.json({ success: false, error: 'Could not build trade ideas. Try again in a minute.' }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const { ctx, error } = await requireLeague();
  if (error) return error;
  const body = await req.json().catch(() => null);
  const block = Array.isArray(body?.block) ? body.block.filter((x: unknown) => Number.isInteger(x) && (x as number) > 0).slice(0, 20) : null;
  if (!block) return NextResponse.json({ success: false, error: 'Send { block: [player ids] }' }, { status: 400 });
  await kvStore().set(blockKey(ctx), block);
  return NextResponse.json({ success: true, block });
}
