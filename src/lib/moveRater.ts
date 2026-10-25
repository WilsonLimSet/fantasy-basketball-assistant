import { getPlayers } from "./data";
import { fppg, gamesIn, round1, streamWindow, teamTips } from "./social";
import type { Player } from "./types";

/**
 * "Rate my move": drop one player, add another, get a verdict anyone can share. Free and public, so
 * it only uses league-wide data (points per game, games left, minutes, injuries, % rostered), and
 * points people to their own league's waiver wire for the real answer.
 */

export interface MoveSide {
  id: number; name: string; team: string; pos: string; injury: string;
  fppg: number; games: number; min: number | null; lastMin: number | null; pctOwned: number;
}
export type Verdict = "make" | "stream" | "close" | "keep";
export interface MoveRating { drop: MoveSide; add: MoveSide; verdict: Verdict; headline: string; reasons: string[]; window: string }

const OUT_LIKE = new Set(["OUT", "INJURY_RESERVE", "SUSPENSION"]);

function side(p: Player, games: Map<string, number>): MoveSide {
  return {
    id: p.id, name: p.name, team: p.team, pos: p.pos.join("/"), injury: p.injury,
    fppg: round1(fppg(p)), games: OUT_LIKE.has(p.injury) ? 0 : games.get(p.team) ?? 0,
    min: p.cur?.gp ? round1(p.cur.min) : null, lastMin: p.last?.gp ? round1(p.last.min) : null,
    pctOwned: Math.round(p.pctOwned ?? 0),
  };
}

/** Players worth searching for: anyone with a real role (keeps the picker list small). */
export async function movePlayers(): Promise<{ id: number; name: string; team: string }[]> {
  const { players } = await getPlayers();
  return players
    .filter((p) => p.team !== "FA" && fppg(p) >= 8)
    .sort((a, b) => (b.pctOwned ?? 0) - (a.pctOwned ?? 0))
    .map((p) => ({ id: p.id, name: p.name, team: p.team }));
}

export async function rateMove(dropId: number, addId: number, now = Date.now()): Promise<MoveRating | null> {
  if (dropId === addId) return null;
  const [{ players }, tips] = await Promise.all([getPlayers(), teamTips().catch(() => new Map<string, number[]>())]);
  const dp = players.find((p) => p.id === dropId), ap = players.find((p) => p.id === addId);
  if (!dp || !ap) return null;
  const w = streamWindow(now);
  const games = gamesIn(tips, w, now);
  const drop = side(dp, games), add = side(ap, games);

  const perGame = add.fppg - drop.fppg;
  const thisWeek = add.fppg * add.games - drop.fppg * drop.games;
  const dropOut = OUT_LIKE.has(drop.injury), addOut = OUT_LIKE.has(add.injury);

  let verdict: Verdict;
  if (addOut && !dropOut) verdict = perGame >= 8 ? "close" : "keep";
  else if (perGame >= 2 || (dropOut && perGame >= -3)) verdict = "make";
  // Streaming over a better player only makes sense if he'll still be there to re-add.
  else if (perGame <= -3) verdict = !dropOut && thisWeek >= 20 && drop.pctOwned < 50 ? "stream" : "keep";
  else verdict = thisWeek >= 10 ? "make" : thisWeek <= -10 ? "keep" : "close";

  const headline = {
    make: `Make the move: add ${add.name}`,
    stream: `Only for this week: ${add.name}'s games win it, ${drop.name} is better long term`,
    close: `Close call: ${add.name} vs ${drop.name}`,
    keep: dropOut ? `Keep ${drop.name}: stash him on IR if you can` : `Keep ${drop.name}`,
  }[verdict];

  const reasons: string[] = [];
  const better = perGame >= 0 ? add : drop, worse = perGame >= 0 ? drop : add;
  reasons.push(Math.abs(perGame) < 1
    ? `About even per game: ${add.fppg} vs ${drop.fppg} fantasy points`
    : `${better.name} scores more: ${better.fppg} vs ${worse.fppg} fantasy points per game`);
  if (add.games !== drop.games) reasons.push(`${w.label}: ${add.name} has ${add.games} game${add.games === 1 ? "" : "s"} left, ${drop.name} ${drop.games}`);
  for (const s of [add, drop]) {
    if (s.min != null && s.lastMin != null && Math.abs(s.min - s.lastMin) >= 4) {
      reasons.push(`${s.name} is playing ${s.min > s.lastMin ? "more" : "less"}: ${s.min} minutes a game, ${s.lastMin} last season`);
    }
    if (OUT_LIKE.has(s.injury)) reasons.push(`${s.name} is out injured`);
    else if (s.injury === "DAY_TO_DAY") reasons.push(`${s.name} is day-to-day`);
  }
  if (add.pctOwned < 50) reasons.push(`${add.name} is on waivers in ${100 - add.pctOwned}% of leagues`);
  return { drop, add, verdict, headline, reasons: reasons.slice(0, 5), window: w.label };
}
