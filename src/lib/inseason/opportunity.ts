/**
 * Minutes that open up when a teammate is out. A regular who's ruled out leaves his minutes to
 * the rest of the rotation, mostly to players at his position with room to play more (a bench
 * guard more than a starter already at 34). The boost lasts until he's expected back, so a pickup
 * can be worth keeping for six weeks (a starter's long injury) or only for the next two games.
 */

import type { LeagueSnapshot, Player, PlayerStatus } from '@/types';

const OUT: PlayerStatus[] = ['OUT', 'INJURY_RESERVE', 'SUSPENSION'];
/** Only regulars leave minutes worth chasing. */
const ROTATION_MIN = 18;
/** Teammates playing less than this aren't in the rotation and don't pick up a share. */
const RECIPIENT_MIN = 10;
/** Some minutes go to players deeper than the pool we track (two-way players, garbage time). */
const TRACKED_SHARE = 0.8;
const MAX_BONUS_MIN = 10;
const MAX_MIN = 36;
/** With no return date (or one already passed), count the absence for this many days only. */
const UNDATED_DAYS = 3;
/** Absences this long make a pickup worth keeping, not just streaming. */
export const LONG_ABSENCE_DAYS = 14;
const POSITION_ORDER = ['PG', 'SG', 'SF', 'PF', 'C'];

export interface TeammateBoost {
  out: { id: number; name: string };
  /** First US date (YYYY-MM-DD) he's expected back; the boost counts on days before it. */
  until: string;
  /** false when ESPN gave no return date and we assumed a few days. */
  dated: boolean;
  minutes: number;
  fppg: number;
}

export interface Projection {
  fppg: (p: Player) => number;
  minutes: (p: Player) => number;
  /** How much of the minutes projection rests on this season's games (0 to 1). */
  minutesWeight: (p: Player) => number;
}

const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** How close two players' positions are: same spot 1, next to it (PG/SG, PF/C) 0.6, else 0.25. */
function overlap(a: Player, b: Player): number {
  const ia = a.positions.map((p) => POSITION_ORDER.indexOf(p)).filter((i) => i >= 0);
  const ib = b.positions.map((p) => POSITION_ORDER.indexOf(p)).filter((i) => i >= 0);
  if (!ia.length || !ib.length) return 0.25;
  const gap = Math.min(...ia.flatMap((x) => ib.map((y) => Math.abs(x - y))));
  return gap === 0 ? 1 : gap === 1 ? 0.6 : 0.25;
}

/** Player id -> the minutes he picks up from each teammate who's out (only players who gain at least a minute). */
export function teammateBoosts(snapshot: LeagueSnapshot, asOf: string, proj: Projection): Map<number, TeammateBoost[]> {
  const players = new Map<number, Player>();
  for (const t of snapshot.teams) for (const e of t.roster ?? []) players.set(e.player.id, e.player);
  for (const fa of snapshot.freeAgentsTopN) players.set(fa.player.id, fa.player);

  const byTeam = new Map<number, Player[]>();
  for (const p of players.values()) if (p.nbaTeamId) byTeam.set(p.nbaTeamId, [...(byTeam.get(p.nbaTeamId) ?? []), p]);

  const boosts = new Map<number, TeammateBoost[]>();
  for (const team of byTeam.values()) {
    const teamGames = Math.max(0, ...team.map((p) => p.stats?.gamesPlayed ?? 0));
    const healthy = team.filter((p) => !OUT.includes(p.status) && proj.minutes(p) >= RECIPIENT_MIN);
    const added = new Map<number, number>();
    for (const out of team.filter((p) => OUT.includes(p.status) && proj.minutes(p) >= ROTATION_MIN)) {
      const back = snapshot.injuries?.[out.id]?.returnDate;
      const dated = !!back && back > asOf;
      const until = dated ? back! : addDays(asOf, UNDATED_DAYS);
      // Games he's already missed are in his teammates' minutes this season, so that part isn't new.
      const missed = teamGames ? 1 - Math.min(1, (out.stats?.gamesPlayed ?? 0) / teamGames) : 0;
      const weight = (p: Player) => {
        const m = proj.minutes(p) + (added.get(p.id) ?? 0);
        return overlap(out, p) * m * Math.max(0, MAX_MIN - m) / MAX_MIN;
      };
      const total = healthy.reduce((sum, p) => sum + weight(p), 0);
      if (!total) continue;
      const pool = proj.minutes(out) * TRACKED_SHARE;
      for (const p of healthy) {
        const base = proj.minutes(p);
        const room = MAX_MIN - base - (added.get(p.id) ?? 0);
        const minutes = Math.min(MAX_BONUS_MIN, room, (pool * weight(p) / total) * (1 - missed * proj.minutesWeight(p)));
        if (minutes < 1) continue;
        added.set(p.id, (added.get(p.id) ?? 0) + minutes);
        const fppg = base > 0 ? (minutes * proj.fppg(p)) / base : 0;
        boosts.set(p.id, [...(boosts.get(p.id) ?? []), { out: { id: out.id, name: out.name }, until, dated, minutes, fppg }]);
      }
    }
  }
  return boosts;
}

/** Points per game the boosts add on this date. */
export const boostOn = (boosts: TeammateBoost[] | undefined, date: string) =>
  (boosts ?? []).reduce((sum, b) => sum + (date < b.until ? b.fppg : 0), 0);

/** Points per game from absences of at least LONG_ABSENCE_DAYS, i.e. the part worth holding a player for. */
export const longBoost = (boosts: TeammateBoost[] | undefined, asOf: string) =>
  (boosts ?? []).reduce((sum, b) => sum + (b.dated && b.until >= addDays(asOf, LONG_ABSENCE_DAYS) ? b.fppg : 0), 0);
