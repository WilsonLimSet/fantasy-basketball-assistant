/**
 * Debug endpoint to check ESPN transaction data with enriched player info
 */
import { NextResponse } from 'next/server';
import { getLeagueSnapshot, getRawTransactionData } from '@/lib/espnClient';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const showRaw = searchParams.get('raw') === 'true';

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

    // Get my team ID from env
    const myTeamId = parseInt(process.env.ESPN_MY_TEAM_ID || '1', 10);
    const myTeam = teams?.find(t => t.id === myTeamId);
    const espnWatchlist = myTeam?.watchList || [];

    const result: Record<string, unknown> = {
      totalTransactions: recentTransactions.length,
      drops: drops.length,
      adds: adds.length,
      dropDetails: drops,
      addDetails: adds,
      myTeamId,
      myTeamName: myTeam?.name || 'Unknown',
      espnWatchlist: espnWatchlist.length,
      espnWatchlistPlayerIds: espnWatchlist,
    };

    // Optionally include raw ESPN data for debugging
    if (showRaw) {
      const rawData = await getRawTransactionData();
      result.rawEspnData = rawData;
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
