/**
 * API Route: /api/inseason/moves
 * This week's suggested add/drops, the user's roster (for picking core players) and watchlist notes.
 * Without a pass: a preview (the week's gain and the best move).
 */

import { NextResponse } from 'next/server';
import { requireLeague } from '@/lib/inseason/routeContext';
import { previewContext } from '@/lib/inseason/profile';
import { freshSnapshot } from '@/lib/inseason/refreshLeague';
import { buildStreamingPlan, expectedFppg } from '@/lib/inseason/streaming';
import { compareMatchupGames } from '@/lib/inseason/matchupGames';
import { espnAddUrl } from '@/lib/inseason/email';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Free users' league data is refreshed when they look, at most this often (paid leagues every 30 minutes). */
const PREVIEW_REFRESH_MS = 12 * 60 * 60 * 1000;

/**
 * The free preview for a connected league without a pass: how much the moves add this week and
 * the best one, with the rest behind the paywall.
 */
async function preview() {
  const ctx = await previewContext();
  if (!ctx?.profile && !ctx?.guest) return null;
  const snapshot = await freshSnapshot(ctx, PREVIEW_REFRESH_MS);
  if (!snapshot) return null;
  const plan = buildStreamingPlan(snapshot, ctx.core, []);
  if (!plan) return null;
  return {
    week: plan.week,
    daysLeft: plan.daysLeft,
    pointsLeague: plan.pointsLeague,
    baseline: plan.baseline,
    after: plan.after,
    moveCount: plan.moves.length,
    firstMove: plan.moves[0] ?? null,
    teamName: snapshot.teams.find((t) => t.id === snapshot.myTeamId)?.name,
  };
}

export async function GET() {
  const { ctx, error } = await requireLeague();
  if (error) {
    if (error.status !== 402) return error;
    const p = await preview().catch((e) => { console.error('[moves] preview', e); return null; });
    return p ? NextResponse.json({ success: false, needs: 'pro', preview: p }, { status: 402 }) : error;
  }
  const [snapshot, watchlist] = await Promise.all([
    freshSnapshot(ctx),
    ctx.storage.getWatchlist(ctx.leagueId, ctx.seasonId),
  ]);
  if (!snapshot) {
    return NextResponse.json({ success: false, error: 'No league data yet. Hit Refresh to load it.', needs: 'refresh' }, { status: 404 });
  }
  const plan = buildStreamingPlan(snapshot, ctx.core, watchlist?.playerIds ?? []);
  const me = snapshot.teams.find((t) => t.id === snapshot.myTeamId);
  const roster = (me?.roster ?? [])
    .map((e) => ({
      id: e.player.id,
      name: e.player.name,
      nbaTeamAbbrev: e.player.nbaTeamAbbrev,
      positions: e.player.positions,
      status: e.player.status,
      fppg: Math.round(expectedFppg(e.player) * 10) / 10,
      injuredReserve: e.lineupSlotId === 13,
    }))
    .sort((a, b) => b.fppg - a.fppg);

  return NextResponse.json({
    success: true,
    plan,
    roster,
    matchupGames: compareMatchupGames(snapshot),
    teamName: me?.name,
    espnUrl: espnAddUrl(String(ctx.leagueId), ctx.myTeamId),
    snapshotAge: Date.now() - snapshot.fetchedAt,
  });
}
