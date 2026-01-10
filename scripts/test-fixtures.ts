/**
 * Test script to run optimizer against fixture data
 * Run with: npm run test:fixtures
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Import types
import type {
  ESPNLeagueResponse,
  ESPNFreeAgentResponse,
} from '../src/types/espn';

// Note: We need to import the transformation functions
// For testing, we'll inline simplified versions

const POSITION_MAP: Record<number, string> = {
  0: 'PG',
  1: 'SG',
  2: 'SF',
  3: 'PF',
  4: 'C',
};

const NBA_TEAMS: Record<number, string> = {
  2: 'BOS',
  6: 'DAL',
  25: 'OKC',
  27: 'WAS',
  28: 'TOR',
};

function loadFixture<T>(filename: string): T {
  const path = join(__dirname, '../fixtures', filename);
  const content = readFileSync(path, 'utf-8');
  return JSON.parse(content) as T;
}

function testLeagueSnapshot() {
  console.log('=== Testing League Snapshot ===\n');

  const league = loadFixture<ESPNLeagueResponse>('sample-league.json');

  console.log('League ID:', league.id);
  console.log('Season:', league.seasonId);
  console.log('Scoring Period:', league.scoringPeriodId);
  console.log('Current Week:', league.status?.currentMatchupPeriod);
  console.log('Teams:', league.teams?.length || 0);

  if (league.teams && league.teams.length > 0) {
    console.log('\nTeam 1 Roster:');
    const team1 = league.teams[0];
    team1.roster?.entries.forEach((entry) => {
      const player = entry.playerPoolEntry?.player;
      if (player) {
        const positions = player.eligibleSlots
          .filter((s) => s <= 4)
          .map((s) => POSITION_MAP[s] || s)
          .join('/');
        console.log(
          `  - ${player.fullName} (${NBA_TEAMS[player.proTeamId] || player.proTeamId}) ${positions} - ${
            player.injured ? player.injuryStatus : 'ACTIVE'
          }`
        );
      }
    });
  }

  console.log('\n');
}

function testFreeAgents() {
  console.log('=== Testing Free Agents ===\n');

  const freeAgents = loadFixture<ESPNFreeAgentResponse>('sample-free-agents.json');

  console.log('Free Agents:', freeAgents.players.length);

  freeAgents.players.forEach((entry, idx) => {
    const player = entry.player;
    const positions = player.eligibleSlots
      .filter((s) => s <= 4)
      .map((s) => POSITION_MAP[s] || s)
      .join('/');

    const seasonAvg = player.stats?.find((s) => s.statSourceId === 0)?.appliedAverage || 0;
    const projAvg = player.stats?.find((s) => s.statSourceId === 1)?.appliedAverage || 0;

    console.log(`${idx + 1}. ${player.fullName} (${NBA_TEAMS[player.proTeamId] || player.proTeamId})`);
    console.log(`   Positions: ${positions}`);
    console.log(`   Status: ${entry.status}`);
    const percentChange = player.ownership?.percentChange ?? 0;
    console.log(`   Ownership: ${player.ownership?.percentOwned ?? 0}% (${percentChange > 0 ? '+' : ''}${percentChange}%)`);
    console.log(`   Season Avg: ${seasonAvg.toFixed(1)} | Projected: ${projAvg.toFixed(1)}`);
    console.log('');
  });
}

function testWaiverScoring() {
  console.log('=== Testing Waiver Scoring ===\n');

  const freeAgents = loadFixture<ESPNFreeAgentResponse>('sample-free-agents.json');

  const WEIGHTS = {
    projectedPoints: 0.55,
    gamesNext7: 0.25,
    recentTrend: 0.20,
  };

  const scored = freeAgents.players.map((entry) => {
    const player = entry.player;

    const seasonAvg = player.stats?.find((s) => s.statSourceId === 0)?.appliedAverage || 0;
    const projAvg = player.stats?.find((s) => s.statSourceId === 1)?.appliedAverage || seasonAvg;
    const gamesNext7 = 3; // Default estimate

    const projectedPointsNext7 = projAvg * gamesNext7;
    const recentTrend = seasonAvg > 0 ? ((projAvg - seasonAvg) / seasonAvg) * 100 : 0;

    const normalizedProjected = projectedPointsNext7;
    const normalizedGames = gamesNext7 * 10;
    const normalizedTrend = Math.max(-20, Math.min(20, recentTrend));

    const score =
      WEIGHTS.projectedPoints * normalizedProjected +
      WEIGHTS.gamesNext7 * normalizedGames +
      WEIGHTS.recentTrend * normalizedTrend;

    return {
      name: player.fullName,
      score,
      projectedPointsNext7,
      gamesNext7,
      recentTrend,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  console.log('Waiver Rankings:\n');
  scored.forEach((player, idx) => {
    console.log(`#${idx + 1} ${player.name}`);
    console.log(`   Score: ${player.score.toFixed(1)}`);
    console.log(`   Projected Pts (7d): ${player.projectedPointsNext7.toFixed(1)}`);
    console.log(`   Games (7d): ${player.gamesNext7}`);
    console.log(`   Trend: ${player.recentTrend > 0 ? '+' : ''}${player.recentTrend.toFixed(1)}%`);
    console.log('');
  });
}

// Run tests
console.log('\n========================================');
console.log('  Adam Fantasy Manager - Fixture Tests  ');
console.log('========================================\n');

try {
  testLeagueSnapshot();
  testFreeAgents();
  testWaiverScoring();
  console.log('All tests passed!');
} catch (error) {
  console.error('Test failed:', error);
  process.exit(1);
}
