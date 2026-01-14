/**
 * Smart Alerts Generator
 * Context-aware alerts about injuries/returns affecting YOUR roster and watchlist
 *
 * Key insight: ESPN already shows top adds. We alert on OPPORTUNITIES:
 * - Teammate of your roster player injured → your player's usage goes UP
 * - Teammate of your roster player returns → your player's usage goes DOWN
 * - Teammate of watchlist player injured → watchlist player worth adding
 * - Teammate of watchlist player returns → watchlist player less valuable
 *
 * IMPORTANT: Only HIGH-USAGE stars matter for usage redistribution.
 * Zubac (role player center) out doesn't help Harden.
 * Kawhi (high-usage wing) out DOES help Harden - touches redistribute to everyone.
 */

import type {
  LeagueSnapshot,
  SnapshotDiff,
  StatusChange,
  SmartAlert,
  Player,
  Watchlist,
  PlayerStatus,
  LeagueTransaction,
  NBATeamSchedule,
} from '@/types';

// Injury statuses that indicate player is OUT
const OUT_STATUSES: PlayerStatus[] = ['OUT', 'INJURY_RESERVE', 'SUSPENSION'];

// High-usage stars threshold - these are true usage monsters
// When they're out, the whole team's usage shifts (not just their position)
const STAR_THRESHOLD = 25; // Starter-level players whose absence redistributes usage

// Threshold for alerting on dropped players - only elite players
const DROPPED_PLAYER_THRESHOLD = 35; // Only alert on 35+ pts drops

// Streamer threshold - players below this are "streamers" worth schedule alerts
const STREAMER_THRESHOLD = 30; // Players under 30 pts are streaming candidates

/**
 * Check if a player is a HIGH-USAGE STAR whose absence redistributes touches
 * This is NOT about position - it's about usage rate and shot volume
 *
 * Examples:
 * - Kawhi (40+ pts) → HIGH IMPACT - his touches go to everyone
 * - Zubac (18 pts) → LOW IMPACT - he's a role player, just catches lobs
 * - Harden (45+ pts) → HIGH IMPACT - primary ball handler
 */
function isHighUsageStar(player: Player): boolean {
  const projectedAvg = player.stats?.projectedAvg || 0;
  // Only true stars (top ~30-40 players) create real usage shifts
  return projectedAvg >= STAR_THRESHOLD;
}

/**
 * Check if two players share a position (same minutes pool)
 * Examples: Both are C, both are PG, one is SG/SF and other is SF
 */
function sharesPosition(player1: Player, player2: Player): boolean {
  // Check if any position overlaps
  return player1.positions.some(pos => player2.positions.includes(pos));
}

/**
 * Check if player just went OUT (was active/DTD before, now OUT)
 */
function justWentOut(change: StatusChange): boolean {
  const wasAvailable = !OUT_STATUSES.includes(change.previousStatus);
  const isNowOut = OUT_STATUSES.includes(change.currentStatus);
  return wasAvailable && isNowOut;
}

/**
 * Check if player just returned (was OUT, now active)
 */
function justReturned(change: StatusChange): boolean {
  const wasOut = OUT_STATUSES.includes(change.previousStatus);
  const isNowAvailable = change.currentStatus === 'ACTIVE';
  return wasOut && isNowAvailable;
}

/**
 * Find teammates of a player in the snapshot
 */
function findTeammates(player: Player, snapshot: LeagueSnapshot): Player[] {
  const teammates: Player[] = [];

  // Check rostered players
  for (const team of snapshot.teams) {
    if (team.roster) {
      for (const entry of team.roster) {
        if (entry.player.nbaTeamId === player.nbaTeamId && entry.player.id !== player.id) {
          teammates.push(entry.player);
        }
      }
    }
  }

  // Check free agents
  for (const fa of snapshot.freeAgentsTopN) {
    if (fa.player.nbaTeamId === player.nbaTeamId && fa.player.id !== player.id) {
      teammates.push(fa.player);
    }
  }

  return teammates;
}

/**
 * Find a player in the snapshot by ID
 */
function findPlayerById(playerId: number, snapshot: LeagueSnapshot): Player | null {
  // Check all team rosters
  for (const team of snapshot.teams) {
    if (team.roster) {
      const entry = team.roster.find(r => r.playerId === playerId);
      if (entry) return entry.player;
    }
  }

  // Check free agents
  const fa = snapshot.freeAgentsTopN.find(f => f.player.id === playerId);
  if (fa) return fa.player;

  return null;
}

/**
 * Check if player is on my roster
 */
function isOnMyRoster(playerId: number, snapshot: LeagueSnapshot): boolean {
  const myTeam = snapshot.teams.find(t => t.id === snapshot.myTeamId);
  return myTeam?.roster?.some(r => r.playerId === playerId) || false;
}

/**
 * Check if player is on watchlist
 */
function isOnWatchlist(playerId: number, watchlist: Watchlist | null): boolean {
  return watchlist?.playerIds.includes(playerId) || false;
}

/**
 * Check if a player is a streamer (below star threshold, worth schedule optimization)
 */
function isStreamer(player: Player): boolean {
  const projectedAvg = player.stats?.projectedAvg || 0;
  return projectedAvg < STREAMER_THRESHOLD && projectedAvg > 0;
}

/**
 * Get next N days as date strings (YYYY-MM-DD format)
 */
function getNextNDays(n: number): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    days.push(date.toISOString().split('T')[0]);
  }
  return days;
}

/**
 * Detect back-to-back games in schedule
 */
function hasBackToBack(schedule: NBATeamSchedule, nextDays: string[]): { has: boolean; days: string[] } {
  for (let i = 0; i < nextDays.length - 1; i++) {
    const day1 = nextDays[i];
    const day2 = nextDays[i + 1];
    if (schedule.gamesByDay[day1] && schedule.gamesByDay[day2]) {
      return { has: true, days: [day1, day2] };
    }
  }
  return { has: false, days: [] };
}

/**
 * Detect dead zone (3+ days without a game)
 */
function hasDeadZone(schedule: NBATeamSchedule, nextDays: string[]): { has: boolean; daysWithoutGame: number } {
  let consecutiveOff = 0;
  let maxOff = 0;

  for (const day of nextDays) {
    if (!schedule.gamesByDay[day]) {
      consecutiveOff++;
      maxOff = Math.max(maxOff, consecutiveOff);
    } else {
      consecutiveOff = 0;
    }
  }

  return { has: maxOff >= 3, daysWithoutGame: maxOff };
}

/**
 * Generate schedule-based alerts for streamers
 * Only alerts on EXCEPTIONS: dead zones (3+ days off) or light weeks
 */
function generateScheduleAlerts(
  snapshot: LeagueSnapshot,
  myRoster: Player[]
): SmartAlert[] {
  const alerts: SmartAlert[] = [];
  const now = Date.now();
  const next3Days = getNextNDays(3);
  const next7Days = getNextNDays(7);

  // Only check streamers (< 30 pts avg)
  const streamers = myRoster.filter(p => isStreamer(p));
  if (streamers.length === 0) return alerts;

  // Calculate games this week for each streamer
  const streamerGames: { player: Player; games: number }[] = [];

  for (const player of streamers) {
    const schedule = snapshot.scheduleIndex[player.nbaTeamId];
    if (!schedule) continue;

    const gamesThisWeek = next7Days.filter(day => schedule.gamesByDay[day]).length;
    streamerGames.push({ player, games: gamesThisWeek });
  }

  // Find average games
  const avgGames = streamerGames.reduce((sum, s) => sum + s.games, 0) / streamerGames.length;

  const warnings: string[] = [];

  for (const { player, games } of streamerGames) {
    const schedule = snapshot.scheduleIndex[player.nbaTeamId];
    if (!schedule) continue;

    // Dead zone: no games in next 3 days
    const hasGameNext3 = next3Days.some(day => schedule.gamesByDay[day]);
    if (!hasGameNext3) {
      warnings.push(`⏸️ ${player.name} - no games next 3 days`);
      continue;
    }

    // Light week: 2+ fewer games than average
    if (games <= avgGames - 2 && games <= 2) {
      warnings.push(`📉 ${player.name} - only ${games} games this week`);
    }
  }

  if (warnings.length > 0) {
    alerts.push({
      type: 'WEEKLY_SUMMARY',
      priority: 'MEDIUM',
      title: '',
      playerName: '',
      teamAbbrev: '',
      details: warnings.join('\n'),
      timestamp: now,
    });
  }

  return alerts;
}

/**
 * Generate smart alerts from snapshot diff
 * FOCUSED ON: How injuries/returns affect YOUR roster and watchlist
 * Also tracks league activity (adds/drops by other teams)
 */
export function generateSmartAlerts(
  snapshot: LeagueSnapshot,
  diff: SnapshotDiff,
  watchlist: Watchlist | null,
  recentTransactions?: LeagueTransaction[]
): SmartAlert[] {
  const alerts: SmartAlert[] = [];
  const now = Date.now();
  const myTeam = snapshot.teams.find(t => t.id === snapshot.myTeamId);
  const myRosterPlayerIds = new Set(myTeam?.roster?.map(r => r.playerId) || []);
  const watchlistPlayerIds = new Set(watchlist?.playerIds || []);

  // Build a map of NBA team -> players we care about (roster + watchlist)
  const playersWeCareAbout: Map<number, Player[]> = new Map();

  // Add roster players
  if (myTeam?.roster) {
    for (const entry of myTeam.roster) {
      const teamId = entry.player.nbaTeamId;
      if (!playersWeCareAbout.has(teamId)) {
        playersWeCareAbout.set(teamId, []);
      }
      playersWeCareAbout.get(teamId)!.push(entry.player);
    }
  }

  // Add watchlist players
  if (watchlist) {
    for (const playerId of watchlist.playerIds) {
      const player = findPlayerById(playerId, snapshot);
      if (player) {
        const teamId = player.nbaTeamId;
        if (!playersWeCareAbout.has(teamId)) {
          playersWeCareAbout.set(teamId, []);
        }
        // Avoid duplicates
        if (!playersWeCareAbout.get(teamId)!.some(p => p.id === player.id)) {
          playersWeCareAbout.get(teamId)!.push(player);
        }
      }
    }
  }

  // Process each status change
  for (const change of diff.statusChanges) {
    const changedPlayer = findPlayerById(change.playerId, snapshot);
    if (!changedPlayer) continue;

    const isMyPlayer = myRosterPlayerIds.has(change.playerId);
    const isWatchlistPlayer = watchlistPlayerIds.has(change.playerId);
    const wentOut = justWentOut(change);
    const returned = justReturned(change);

    // 1. MY PLAYER GOT INJURED
    if (isMyPlayer && wentOut) {
      alerts.push({
        type: 'ROSTER_INJURY',
        priority: 'HIGH',
        title: `🚨 ${change.playerName} is OUT`,
        playerName: change.playerName,
        teamAbbrev: changedPlayer.nbaTeamAbbrev,
        details: change.injuryNote || `Status: ${change.currentStatus}`,
        action: 'Find a replacement on waivers',
        timestamp: now,
      });
      continue;
    }

    // 2. MY PLAYER RETURNED
    if (isMyPlayer && returned) {
      alerts.push({
        type: 'ROSTER_RETURN',
        priority: 'MEDIUM',
        title: `✅ ${change.playerName} is BACK`,
        playerName: change.playerName,
        teamAbbrev: changedPlayer.nbaTeamAbbrev,
        details: 'Returned from injury',
        action: 'Move to starting lineup',
        timestamp: now,
      });
      continue;
    }

    // 3. TEAMMATE OF MY ROSTER/WATCHLIST PLAYER CHANGED STATUS
    // Only care about impactful players (starters)
    if (!isHighUsageStar(changedPlayer)) continue;

    const affectedPlayers = playersWeCareAbout.get(changedPlayer.nbaTeamId) || [];
    // Filter out the changed player themselves
    const beneficiaries = affectedPlayers.filter(p => p.id !== changedPlayer.id);

    if (beneficiaries.length === 0) continue;

    // Separate roster vs watchlist beneficiaries
    const rosterBeneficiaries = beneficiaries.filter(p => myRosterPlayerIds.has(p.id));
    const watchlistBeneficiaries = beneficiaries.filter(p => watchlistPlayerIds.has(p.id));

    if (wentOut) {
      // Teammate injured = USAGE BOOST for our players
      if (rosterBeneficiaries.length > 0) {
        const names = rosterBeneficiaries.map(p => p.name).join(', ');
        alerts.push({
          type: 'TEAMMATE_INJURY',
          priority: 'HIGH',
          title: `📈 ${changedPlayer.name} is OUT`,
          playerName: changedPlayer.name,
          teamAbbrev: changedPlayer.nbaTeamAbbrev,
          details: `Your ${names} should see MORE usage/shots`,
          action: 'Start them if on bench',
          relatedPlayers: rosterBeneficiaries.map(p => p.name),
          timestamp: now,
        });
      }

      if (watchlistBeneficiaries.length > 0) {
        const names = watchlistBeneficiaries.map(p => p.name).join(', ');
        alerts.push({
          type: 'WATCHLIST_OPPORTUNITY',
          priority: 'HIGH',
          title: `🔥 Add ${names} - ${changedPlayer.name} is OUT`,
          playerName: changedPlayer.name,
          teamAbbrev: changedPlayer.nbaTeamAbbrev,
          details: `${changedPlayer.name} injury = more usage for ${names}`,
          action: `Pick up ${watchlistBeneficiaries[0].name} now`,
          relatedPlayers: watchlistBeneficiaries.map(p => p.name),
          timestamp: now,
        });
      }
    }

    if (returned) {
      // Teammate returned = USAGE DROP for our players
      if (rosterBeneficiaries.length > 0) {
        const names = rosterBeneficiaries.map(p => p.name).join(', ');
        alerts.push({
          type: 'TEAMMATE_INJURY', // reusing type
          priority: 'MEDIUM',
          title: `📉 ${changedPlayer.name} is BACK`,
          playerName: changedPlayer.name,
          teamAbbrev: changedPlayer.nbaTeamAbbrev,
          details: `Your ${names} may see LESS usage now`,
          action: 'Monitor their production',
          relatedPlayers: rosterBeneficiaries.map(p => p.name),
          timestamp: now,
        });
      }

      if (watchlistBeneficiaries.length > 0) {
        const names = watchlistBeneficiaries.map(p => p.name).join(', ');
        alerts.push({
          type: 'WATCHLIST_OPPORTUNITY',
          priority: 'LOW',
          title: `⚠️ ${changedPlayer.name} is BACK`,
          playerName: changedPlayer.name,
          teamAbbrev: changedPlayer.nbaTeamAbbrev,
          details: `${names} value decreased - ${changedPlayer.name} returns`,
          action: 'Maybe remove from watchlist',
          relatedPlayers: watchlistBeneficiaries.map(p => p.name),
          timestamp: now,
        });
      }
    }
  }

  // ============ CURRENT ROSTER INJURY ALERTS ============
  // Alert on players currently OUT or DAY_TO_DAY on your roster
  // This is independent of status changes - shows current state
  const myRosterPlayers = myTeam?.roster?.map(r => r.player) || [];

  for (const player of myRosterPlayers) {
    if (OUT_STATUSES.includes(player.status)) {
      alerts.push({
        type: 'ROSTER_INJURY',
        priority: 'HIGH',
        title: `🚨 ${player.name} is ${player.status}`,
        playerName: player.name,
        teamAbbrev: player.nbaTeamAbbrev,
        details: player.injuryNote || `Status: ${player.status}`,
        timestamp: now,
      });
    } else if (player.status === 'DAY_TO_DAY' || player.status === 'QUESTIONABLE' || player.status === 'DOUBTFUL') {
      alerts.push({
        type: 'ROSTER_INJURY',
        priority: 'MEDIUM',
        title: `⚠️ ${player.name} is ${player.status}`,
        playerName: player.name,
        teamAbbrev: player.nbaTeamAbbrev,
        details: player.injuryNote || `Status: ${player.status}`,
        timestamp: now,
      });
    }
  }

  // ============ SCHEDULE-BASED ALERTS ============
  // Alert on B2B games, heavy weeks, dead zones for streamers
  const scheduleAlerts = generateScheduleAlerts(snapshot, myRosterPlayers);
  alerts.push(...scheduleAlerts);

  // ============ LEAGUE ACTIVITY ALERTS ============
  // Track adds/drops by other teams
  if (recentTransactions && recentTransactions.length > 0) {
    // Build team name lookup
    const teamNameById = new Map(snapshot.teams.map(t => [t.id, t.name]));

    for (const tx of recentTransactions) {
      // Skip our own transactions
      if (tx.teamId === snapshot.myTeamId) continue;

      // Use enriched transaction data first, fallback to snapshot lookup
      const player = findPlayerById(tx.playerId, snapshot);
      const playerName = tx.playerName || player?.name || `Player #${tx.playerId}`;
      const teamName = teamNameById.get(tx.teamId) || `Team #${tx.teamId}`;
      // Use enriched seasonAvg from transaction, fallback to player lookup
      const seasonAvg = tx.playerSeasonAvg ?? player?.stats?.seasonAvg ?? 0;
      const teamAbbrev = tx.playerTeamAbbrev || player?.nbaTeamAbbrev;

      if (tx.type === 'DROP') {
        const isWatchlistDrop = watchlistPlayerIds.has(tx.playerId);
        const isEliteDrop = seasonAvg >= DROPPED_PLAYER_THRESHOLD;

        // Only alert if on watchlist OR above 35 pts
        if (isWatchlistDrop || isEliteDrop) {
          const avgStr = seasonAvg > 0 ? ` (${seasonAvg.toFixed(1)})` : '';
          alerts.push({
            type: 'HOT_WAIVER_ADD',
            priority: 'HIGH',
            title: `🎯 ${playerName}${avgStr} dropped by ${teamName}`,
            playerName: playerName,
            teamAbbrev: teamAbbrev,
            details: '',
            timestamp: now,
          });
        }
      }

      if (tx.type === 'ADD') {
        // Alert if a league mate added someone on our watchlist
        if (watchlistPlayerIds.has(tx.playerId)) {
          const avgStr = seasonAvg > 0 ? ` (${seasonAvg.toFixed(1)})` : '';
          alerts.push({
            type: 'WATCHLIST_OPPORTUNITY',
            priority: 'HIGH',  // Upgrade to HIGH - watchlist snipe is important
            title: `❌ ${playerName}${avgStr} SNIPED by ${teamName}`,
            playerName: playerName,
            teamAbbrev: teamAbbrev,
            details: `Was on your watchlist - no longer available`,
            action: 'Remove from watchlist',
            timestamp: now,
          });
        }
      }
    }
  }

  return alerts;
}

/**
 * Check if there are any alerts worth sending
 */
export function hasActionableAlerts(alerts: SmartAlert[]): boolean {
  return alerts.some(a => a.priority === 'HIGH' || a.priority === 'MEDIUM');
}

/**
 * Sort alerts by priority
 */
export function sortAlertsByPriority(alerts: SmartAlert[]): SmartAlert[] {
  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return [...alerts].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}
