/**
 * Fantasy Basketball Optimizer
 * Waiver ranking, streaming plans, and injury detection
 */

import type {
  LeagueSnapshot,
  Player,
  Team,
  FreeAgentEntry,
  WaiverRecommendation,
  WeeklyStreamingPlan,
  StreamingSlot,
  InjuryOpportunity,
  RosterEntry,
  NBATeamSchedule,
  DailyBriefing,
  StatusChange,
  PlayerStatus,
  InjuryHistoryIndex,
} from '@/types';
import { getInjuryRiskAssessment, formatInjuryRisk } from '@/lib/injuryTracker';

// ============ Scoring Weights ============

// Weights optimized for streaming leagues (maximize games)
const WAIVER_WEIGHTS = {
  projectedPoints: 0.40,
  gamesNext7: 0.45,  // Heavily weight games for streaming value
  recentTrend: 0.15,
};

// Injury statuses that should exclude players from recommendations
const INJURED_STATUSES: PlayerStatus[] = ['OUT', 'INJURY_RESERVE', 'SUSPENSION'];

const STREAMING_WEIGHTS = {
  games: 0.50,
  projected: 0.35,
  upside: 0.15,
};

// ============ Waiver Wire Ranking ============

/**
 * Score a player for waiver wire ranking
 */
function scoreWaiverCandidate(
  player: Player,
  schedule: NBATeamSchedule | undefined
): { score: number; details: { projected: number; games: number; trend: number } } {
  const gamesNext7 = schedule?.gamesNext7Days || 3;
  const projectedAvg = player.stats?.projectedAvg || 15;
  const seasonAvg = player.stats?.seasonAvg || projectedAvg;

  // Calculate projected points for next 7 days
  const projectedPointsNext7 = projectedAvg * gamesNext7;

  // Calculate trend (% difference from season average)
  const recentTrend = seasonAvg > 0
    ? ((projectedAvg - seasonAvg) / seasonAvg) * 100
    : 0;

  // Normalize components
  const normalizedProjected = projectedPointsNext7;
  const normalizedGames = gamesNext7 * 10; // Scale to be comparable
  const normalizedTrend = Math.max(-20, Math.min(20, recentTrend));

  const score =
    WAIVER_WEIGHTS.projectedPoints * normalizedProjected +
    WAIVER_WEIGHTS.gamesNext7 * normalizedGames +
    WAIVER_WEIGHTS.recentTrend * normalizedTrend;

  return {
    score,
    details: {
      projected: projectedPointsNext7,
      games: gamesNext7,
      trend: recentTrend,
    },
  };
}

/**
 * Generate reasons for waiver recommendation
 */
function generateWaiverReasons(
  player: Player,
  games: number,
  trend: number,
  schedule: NBATeamSchedule | undefined
): string[] {
  const reasons: string[] = [];

  if (games >= 4) {
    reasons.push(`${games} games in next 7 days`);
  } else if (games === 3) {
    reasons.push('Average schedule (3 games)');
  }

  if (trend > 15) {
    reasons.push('Hot streak (+' + trend.toFixed(0) + '% vs avg)');
  } else if (trend > 5) {
    reasons.push('Trending up');
  } else if (trend < -10) {
    reasons.push('⚠️ Trending down');
  }

  if (player.ownership) {
    if (player.ownership.percentOwned > 70) {
      reasons.push('Widely rostered (' + player.ownership.percentOwned.toFixed(0) + '%)');
    }
    if (player.ownership.percentChange > 10) {
      reasons.push('🔥 Rising fast (+' + player.ownership.percentChange.toFixed(0) + '%)');
    }
  }

  if (player.positions.length > 2) {
    reasons.push('Multi-position eligible');
  }

  return reasons;
}

/**
 * Check if a player is injured and should be excluded
 */
function isPlayerInjured(player: Player): boolean {
  return INJURED_STATUSES.includes(player.status);
}

/**
 * Get top waiver recommendations
 * Filters out injured players (OUT, IR, SUSPENDED)
 * Applies injury history penalty to injury-prone players
 */
export function getWaiverRecommendations(
  snapshot: LeagueSnapshot,
  limit = 10,
  injuryHistory?: InjuryHistoryIndex | null
): WaiverRecommendation[] {
  const recommendations: WaiverRecommendation[] = [];

  for (const fa of snapshot.freeAgentsTopN) {
    // Skip injured players - they won't help you win games
    if (isPlayerInjured(fa.player)) {
      continue;
    }

    const schedule = snapshot.scheduleIndex[fa.player.nbaTeamId];
    const { score: baseScore, details } = scoreWaiverCandidate(fa.player, schedule);
    const reasons = generateWaiverReasons(fa.player, details.games, details.trend, schedule);

    // Apply injury history penalty
    let score = baseScore;
    if (injuryHistory) {
      const injuryRisk = getInjuryRiskAssessment(fa.player.id, injuryHistory);
      score = baseScore * injuryRisk.scorePenalty;

      // Add injury risk warning to reasons
      if (injuryRisk.riskLevel !== 'LOW') {
        const riskNote = formatInjuryRisk(injuryRisk);
        if (riskNote) {
          reasons.push(`⚠️ ${riskNote}`);
        }
        if (injuryRisk.riskLevel === 'HIGH') {
          reasons.push(`🏥 Injury-prone (${injuryRisk.gamesMissedPct.toFixed(0)}% games missed)`);
        }
      }
    }

    // Flag questionable/DTD players but don't exclude them
    if (fa.player.status === 'DAY_TO_DAY' || fa.player.status === 'QUESTIONABLE') {
      reasons.unshift(`⚠️ ${fa.player.status.replace('_', ' ')}`);
    }

    // Determine confidence - lower for DTD/Questionable or injury-prone
    let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
    const injuryRisk = injuryHistory ? getInjuryRiskAssessment(fa.player.id, injuryHistory) : null;

    if (fa.player.status === 'DAY_TO_DAY' || fa.player.status === 'QUESTIONABLE') {
      confidence = 'LOW';
    } else if (injuryRisk?.riskLevel === 'HIGH') {
      confidence = 'LOW';
    } else if (injuryRisk?.riskLevel === 'MEDIUM') {
      confidence = 'MEDIUM';
    } else if (details.games >= 4 && details.trend > 5) {
      confidence = 'HIGH';
    } else if (details.games <= 2 || details.trend < -10) {
      confidence = 'LOW';
    }

    recommendations.push({
      rank: 0, // Will be set after sorting
      player: fa.player,
      score,
      projectedPointsNext7: details.projected,
      gamesNext7: details.games,
      recentTrend: details.trend,
      reasons,
      confidence,
    });
  }

  // Sort by score and assign ranks
  recommendations.sort((a, b) => b.score - a.score);
  recommendations.forEach((rec, idx) => {
    rec.rank = idx + 1;
  });

  return recommendations.slice(0, limit);
}

// ============ Weekly Streaming Plan ============

/**
 * Get the roster spot candidates for streaming (bench players)
 */
function getStreamingCandidates(team: Team): RosterEntry[] {
  if (!team.roster) return [];

  // Find bench players (lineupSlotId 12 = BE)
  return team.roster.filter((entry) => entry.lineupSlotId === 12);
}

/**
 * Find best streaming add for a given day
 * Excludes injured players
 */
function findStreamingAdd(
  date: string,
  availablePlayers: FreeAgentEntry[],
  scheduleIndex: Record<number, NBATeamSchedule>,
  usedPlayers: Set<number>
): FreeAgentEntry | undefined {
  // Find healthy players with games on this date who aren't already used
  const candidates = availablePlayers.filter((fa) => {
    if (usedPlayers.has(fa.player.id)) return false;
    // Skip injured players for streaming
    if (isPlayerInjured(fa.player)) return false;
    const schedule = scheduleIndex[fa.player.nbaTeamId];
    return schedule?.gamesByDay[date] === true;
  });

  // Return best available by score
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

/**
 * Generate weekly streaming plan
 * Default 5 adds/week for standard ESPN leagues
 */
export function generateWeeklyStreamingPlan(
  snapshot: LeagueSnapshot,
  addsPerWeek = 5
): WeeklyStreamingPlan {
  const myTeam = snapshot.teams.find((t) => t.id === snapshot.myTeamId);
  if (!myTeam) {
    throw new Error('My team not found in snapshot');
  }

  // Get current matchup dates (simplified - would need real schedule)
  const today = new Date();
  const weekDays: string[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    weekDays.push(date.toISOString().split('T')[0]);
  }

  const streamingCandidates = getStreamingCandidates(myTeam);
  const usedPlayerIds = new Set<number>();
  const plan: StreamingSlot[] = [];

  let addsUsed = 0;
  let gamesGained = 0;

  for (const date of weekDays) {
    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });

    // Check if we have adds remaining
    if (addsUsed >= addsPerWeek) {
      plan.push({
        date,
        dayOfWeek,
        reason: 'No adds remaining',
        gamesGained: 0,
      });
      continue;
    }

    // Find a streaming add for this day
    const bestAdd = findStreamingAdd(
      date,
      snapshot.freeAgentsTopN,
      snapshot.scheduleIndex,
      usedPlayerIds
    );

    if (bestAdd) {
      // Find a drop candidate
      const dropCandidate = streamingCandidates.find(
        (entry) => !usedPlayerIds.has(entry.playerId)
      );

      if (dropCandidate) {
        usedPlayerIds.add(bestAdd.player.id);
        usedPlayerIds.add(dropCandidate.playerId);
        addsUsed++;
        gamesGained++;

        plan.push({
          date,
          dayOfWeek,
          recommendedAdd: bestAdd.player,
          recommendedDrop: dropCandidate.player,
          reason: `Add ${bestAdd.player.name} (${bestAdd.player.nbaTeamAbbrev}) for game`,
          gamesGained: 1,
        });
      } else {
        plan.push({
          date,
          dayOfWeek,
          reason: 'No drop candidates available',
          gamesGained: 0,
        });
      }
    } else {
      plan.push({
        date,
        dayOfWeek,
        reason: 'No advantageous streaming options',
        gamesGained: 0,
      });
    }
  }

  // Calculate total games with and without streaming
  const baseGames = (myTeam.roster?.length || 10) * 3; // Estimate
  const totalGamesWithStreaming = baseGames + gamesGained;

  return {
    week: snapshot.week,
    weekStartDate: weekDays[0],
    weekEndDate: weekDays[weekDays.length - 1],
    totalGamesWithStreaming,
    totalGamesWithoutStreaming: baseGames,
    gamesGained,
    addsRemaining: addsPerWeek - addsUsed,
    addsUsed,
    plan,
  };
}

// ============ Injury Opportunity Detection ============

/**
 * Find players who could benefit from an injury
 */
export function detectInjuryOpportunities(
  snapshot: LeagueSnapshot,
  statusChanges: StatusChange[]
): InjuryOpportunity[] {
  const opportunities: InjuryOpportunity[] = [];

  // Filter for new injuries on rostered players
  const newInjuries = statusChanges.filter(
    (change) =>
      change.isMyPlayer &&
      (change.currentStatus === 'OUT' ||
        change.currentStatus === 'INJURY_RESERVE' ||
        change.currentStatus === 'DAY_TO_DAY')
  );

  for (const injury of newInjuries) {
    // Find the injured player's team
    const myTeam = snapshot.teams.find((t) => t.id === snapshot.myTeamId);
    const injuredEntry = myTeam?.roster?.find((r) => r.playerId === injury.playerId);
    if (!injuredEntry) continue;

    const injuredPlayer = injuredEntry.player;

    // Find available players on the same NBA team
    const sameTeamFAs = snapshot.freeAgentsTopN.filter(
      (fa) => fa.player.nbaTeamId === injuredPlayer.nbaTeamId
    );

    if (sameTeamFAs.length === 0) continue;

    // Score beneficiaries
    const beneficiaries = sameTeamFAs
      .map((fa) => {
        const schedule = snapshot.scheduleIndex[fa.player.nbaTeamId];
        const { score, details } = scoreWaiverCandidate(fa.player, schedule);

        // Boost score for same position
        const samePosition = fa.player.positions.some((pos) =>
          injuredPlayer.positions.includes(pos)
        );
        const boostedScore = samePosition ? score * 1.2 : score;

        // Determine confidence
        let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
        if (samePosition && details.games >= 3) {
          confidence = 'HIGH';
        } else if (!samePosition || details.games <= 2) {
          confidence = 'LOW';
        }

        const reasons: string[] = [];
        if (samePosition) reasons.push('Same position - likely usage boost');
        if (details.games >= 4) reasons.push(`${details.games} games upcoming`);
        if (fa.player.ownership && fa.player.ownership.percentChange > 5) {
          reasons.push('Rising ownership');
        }

        return {
          player: fa.player,
          score: boostedScore,
          confidence,
          reasons,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    opportunities.push({
      injuredPlayer,
      injuryStatus: injury.currentStatus,
      injuryNote: injury.injuryNote,
      beneficiaries,
      timestamp: injury.timestamp,
    });
  }

  return opportunities;
}

// ============ Daily Briefing Generation ============

/**
 * Generate daily briefing
 */
export function generateDailyBriefing(
  snapshot: LeagueSnapshot,
  statusChanges: StatusChange[]
): DailyBriefing {
  const myTeam = snapshot.teams.find((t) => t.id === snapshot.myTeamId);
  if (!myTeam) {
    throw new Error('My team not found in snapshot');
  }

  // Get waiver recommendations
  const topWaiverAdds = getWaiverRecommendations(snapshot, 5);

  // Detect injury opportunities
  const injuryOpportunities = detectInjuryOpportunities(snapshot, statusChanges);

  // Build upcoming games list
  const upcomingGames = (myTeam.roster || []).map((entry) => ({
    player: entry.player,
    nextGameDate: undefined, // Would need schedule data
    opponent: undefined,
  }));

  // Build action items
  const actionItems: string[] = [];

  const myStatusChanges = statusChanges.filter((sc) => sc.isMyPlayer);
  if (myStatusChanges.length > 0) {
    const outPlayers = myStatusChanges.filter(
      (sc) => sc.currentStatus === 'OUT' || sc.currentStatus === 'INJURY_RESERVE'
    );
    if (outPlayers.length > 0) {
      actionItems.push(
        `⚠️ ${outPlayers.length} player(s) now OUT - consider replacements`
      );
    }
  }

  if (topWaiverAdds.length > 0 && topWaiverAdds[0].confidence === 'HIGH') {
    actionItems.push(
      `🌟 High-confidence add: ${topWaiverAdds[0].player.name} (${topWaiverAdds[0].gamesNext7} games)`
    );
  }

  if (injuryOpportunities.length > 0) {
    actionItems.push(
      `🏥 ${injuryOpportunities.length} injury opportunity alert(s)`
    );
  }

  // Build diff summary
  const diffSummary: string[] = [];
  if (myStatusChanges.length > 0) {
    diffSummary.push(`${myStatusChanges.length} roster player status change(s)`);
  }

  return {
    generatedAt: Date.now(),
    week: snapshot.week,
    myTeam,
    statusChanges,
    upcomingGames,
    actionItems,
    topWaiverAdds,
    injuryOpportunities,
    diffSummary,
  };
}

// ============ Drop Recommendations ============

/**
 * Find players on roster who might be worth dropping
 */
export function getDropRecommendations(
  snapshot: LeagueSnapshot,
  limit = 5
): Array<{ player: Player; reasons: string[] }> {
  const myTeam = snapshot.teams.find((t) => t.id === snapshot.myTeamId);
  if (!myTeam?.roster) return [];

  const dropCandidates: Array<{ player: Player; score: number; reasons: string[] }> = [];

  for (const entry of myTeam.roster) {
    const player = entry.player;
    const schedule = snapshot.scheduleIndex[player.nbaTeamId];
    const reasons: string[] = [];
    let dropScore = 0;

    // Factor 1: Low games upcoming
    if (schedule && schedule.gamesNext7Days <= 2) {
      dropScore += 20;
      reasons.push(`Only ${schedule.gamesNext7Days} games next 7 days`);
    }

    // Factor 2: Injured/Out
    if (player.status === 'OUT' || player.status === 'INJURY_RESERVE') {
      dropScore += 30;
      reasons.push(`Status: ${player.status}`);
    }

    // Factor 3: Low ownership/trending down
    if (player.ownership && player.ownership.percentChange < -5) {
      dropScore += 15;
      reasons.push('Ownership trending down');
    }

    // Factor 4: Bench player (not starting)
    if (entry.lineupSlotId === 12) {
      dropScore += 10;
      reasons.push('Currently benched');
    }

    if (reasons.length > 0) {
      dropCandidates.push({ player, score: dropScore, reasons });
    }
  }

  dropCandidates.sort((a, b) => b.score - a.score);
  return dropCandidates.slice(0, limit);
}
