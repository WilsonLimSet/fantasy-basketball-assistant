import type { PlayerStatus } from '@/types';

/**
 * Will he play on this date? ESPN's fantasy tag alone isn't enough: "day-to-day" covers everything
 * from a probable knock to a sprain that keeps him out until Saturday, and "out" players come back
 * midweek. So the injury report's return date decides first (not before it, and back from it), and
 * the tag only fills in when there's no date.
 */

/** Game-time tags without a return date are about the next game or two; later games count in full. */
const GAME_TIME_DAYS = 2;
const TAG_CHANCE: Partial<Record<PlayerStatus, number>> = { DOUBTFUL: 0.25, QUESTIONABLE: 0.6, DAY_TO_DAY: 0.6 };
const OUT_TAGS: PlayerStatus[] = ['OUT', 'INJURY_RESERVE', 'SUSPENSION'];
/** Return dates slip, so his first games back count a bit less than a sure thing. */
const BACK_CHANCE = 0.85;
/** In the games count, a game counts when he's at least this likely to play. */
export const LIKELY = 0.5;

/** Chance he plays a game on `date` (YYYY-MM-DD, US Eastern), `daysAhead` days from today. */
export function chanceOn(status: PlayerStatus, returnDate: string | undefined, date: string, daysAhead: number): number {
  if (returnDate && date < returnDate) return 0;
  const tagged = OUT_TAGS.includes(status) || status in TAG_CHANCE;
  if (returnDate && tagged) return BACK_CHANCE;
  if (OUT_TAGS.includes(status)) return 0;
  if (status in TAG_CHANCE) return daysAhead >= GAME_TIME_DAYS ? 1 : TAG_CHANCE[status]!;
  return 1;
}
