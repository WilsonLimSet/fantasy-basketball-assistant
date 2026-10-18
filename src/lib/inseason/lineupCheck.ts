/**
 * Lineup check before lineups lock: compares the user's ESPN lineup for today with the best one
 * for today's games, so a starter who's been ruled out (or a bench player who should start) gets
 * flagged while there's still time to fix it.
 */

import type { LeagueSnapshot, Player } from '@/types';
import { bestLineup, playChanceToday, playerValue, startingSlots } from './streaming';

const BENCH_SLOT = 12;
const IR_SLOT = 13;
/** Smallest gain worth a message (points leagues). */
const MIN_GAIN = 8;
const OUT: Player['status'][] = ['OUT', 'INJURY_RESERVE', 'SUSPENSION'];

export interface LineupCheck {
  date: string;
  /** Starters who play today but are out or doubtful. */
  hurt: Array<{ name: string; status: Player['status'] }>;
  /** Bench players who should start today, and starters who should sit. */
  start: string[];
  sit: string[];
  /** Expected points the better lineup adds today (games, in categories leagues). */
  gain: number;
}

const easternDate = (ms: number) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

/** Today's lineup problems for the user's team, or null when the lineup is fine (or no games today). */
export function checkLineup(snapshot: LeagueSnapshot, now = Date.now()): LineupCheck | null {
  const week = snapshot.matchupWeek;
  const me = snapshot.teams.find((t) => t.id === snapshot.myTeamId);
  const today = week?.days.find((d) => d.scoringPeriodId === snapshot.scoringPeriodId);
  // Only for an actual game day: the snapshot's scoring period has to be today.
  if (!week || !me?.roster || !today || today.date !== easternDate(now)) return null;

  const playsToday = (p: Player) => (week.teamGames[p.nbaTeamId] ?? []).includes(today.scoringPeriodId);
  const slots = startingSlots(snapshot);
  const value = (p: Player) => playerValue(snapshot, p) * playChanceToday(p.status);

  const active = me.roster.filter((e) => e.lineupSlotId !== IR_SLOT);
  const starters = active.filter((e) => e.lineupSlotId !== BENCH_SLOT).map((e) => e.player);
  const current = starters.filter(playsToday).reduce((sum, p) => sum + value(p), 0);
  const best = bestLineup(active.map((e) => e.player).filter(playsToday), slots, value);

  const hurt = starters.filter((p) => playsToday(p) && (OUT.includes(p.status) || p.status === 'DOUBTFUL'));
  const start = active.filter((e) => e.lineupSlotId === BENCH_SLOT && best.started.has(e.player.id)).map((e) => e.player.name);
  const sit = starters.filter((p) => playsToday(p) && !best.started.has(p.id)).map((p) => p.name);
  const gain = best.total - current;

  const pointsLeague = (snapshot.scoringType ?? '').includes('POINTS');
  if (!hurt.length && gain < (pointsLeague ? MIN_GAIN : 1)) return null;
  return { date: today.date, hurt: hurt.map((p) => ({ name: p.name, status: p.status })), start, sit, gain: Math.round(gain) };
}

/** ESPN's page for setting the lineup. */
export const espnLineupUrl = (leagueId: string, teamId: number) =>
  `https://fantasy.espn.com/basketball/team?leagueId=${leagueId}&teamId=${teamId}`;

const STATUS: Partial<Record<Player['status'], string>> = { OUT: 'out', INJURY_RESERVE: 'out', SUSPENSION: 'suspended', DOUBTFUL: 'doubtful' };

/** The alert as plain sentences, shared by email and Telegram. */
export function lineupLines(c: LineupCheck): { headline: string; lines: string[] } {
  const lines: string[] = [];
  for (const h of c.hurt) lines.push(`${h.name} is ${STATUS[h.status] ?? h.status.toLowerCase()} tonight but in your starting lineup.`);
  if (c.start.length) {
    const many = c.start.length > 1;
    lines.push(`Start ${c.start.join(', ')}: ${many ? 'they play' : 'he plays'} today but ${many ? 'are' : 'is'} on your bench${c.gain > 0 ? ` (about +${c.gain} projected pts)` : ''}.`);
    const hurtNames = new Set(c.hurt.map((h) => h.name));
    const bench = c.sit.filter((n) => !hurtNames.has(n));
    if (bench.length) lines.push(`To make room, bench ${bench.join(', ')}.`);
  } else if (c.hurt.length) lines.push('Nobody on your bench plays today, so a free agent with a game tonight is your only fix.');
  const headline = c.hurt.length
    ? `Lineup alert: ${c.hurt.map((h) => `${h.name} (${STATUS[h.status] ?? h.status.toLowerCase()})`).join(', ')}`
    : `Lineup alert: start ${c.start.join(', ')} tonight`;
  return { headline, lines };
}
