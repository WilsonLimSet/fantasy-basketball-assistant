/**
 * API Route: /api/inseason/moves
 * This week's suggested add/drops, the user's roster (for picking core players) and watchlist notes.
 */

import { NextResponse } from 'next/server';
import { requireLeague } from '@/lib/inseason/routeContext';
import { buildStreamingPlan, expectedFppg } from '@/lib/inseason/streaming';
import { compareMatchupGames } from '@/lib/inseason/matchupGames';
import { espnAddUrl } from '@/lib/inseason/email';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { ctx, error } = await requireLeague();
  if (error) return error;
  const [snapshot, watchlist] = await Promise.all([
    ctx.storage.getLatestSnapshot(ctx.leagueId, ctx.seasonId),
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
