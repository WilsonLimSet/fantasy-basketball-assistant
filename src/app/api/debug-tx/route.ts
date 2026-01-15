/**
 * Debug endpoint to check ESPN transaction data with enriched player info
 */
import { NextResponse } from 'next/server';
import { getLeagueSnapshot } from '@/lib/espnClient';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Use getLeagueSnapshot which now returns enriched transaction data
    const { recentTransactions, teams } = await getLeagueSnapshot();

    // Build team name lookup
    const teamNames: Record<number, string> = {};
    for (const team of teams || []) {
      teamNames[team.id] = team.name || `Team ${team.id}`;
    }

    // Format transactions with all info
    const formatted = recentTransactions.map(tx => ({
      type: tx.type,
      playerId: tx.playerId,
      playerName: tx.playerName || `Player #${tx.playerId}`,
      playerSeasonAvg: tx.playerSeasonAvg?.toFixed(1) || 'N/A',
      playerTeamAbbrev: tx.playerTeamAbbrev || 'N/A',
      teamId: tx.teamId,
      teamName: teamNames[tx.teamId] || `Team ${tx.teamId}`,
      timeAgo: `${Math.round((Date.now() - tx.timestamp) / (1000 * 60 * 60))}h ago`,
    }));

    // Group by type
    const drops = formatted.filter(t => t.type === 'DROP');
    const adds = formatted.filter(t => t.type === 'ADD');

    return NextResponse.json({
      totalTransactions: recentTransactions.length,
      drops: drops.length,
      adds: adds.length,
      dropDetails: drops,
      addDetails: adds,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
