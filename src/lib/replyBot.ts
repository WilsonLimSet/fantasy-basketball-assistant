import { createHmac, timingSafeEqual } from "node:crypto";
import { getPlayers } from "./data";
import { fppg, gamesIn, round1, SITE, streamWindow, teamTips } from "./social";
import { normName } from "./takes";
import type { Player } from "./types";

/**
 * The reply bot behind Postroom's reply hook: someone replies to our Threads or X post with their
 * roster or a "X or Y?" question, and we answer from league-wide data, ending with a pointer to
 * their own league. No AI: player names are matched against ESPN's player list.
 */

const sig = () => createHmac("sha256", process.env.CV_SECRET ?? "dev-secret-change-me").update("reply-hook").digest("base64url").slice(0, 24);
/** The hook URL we hand Postroom; the token stops anyone else from using the endpoint. */
export const replyHookUrl = () => `${SITE}/api/reply?t=${sig()}`;
export function validReplyToken(t: string | null): boolean {
  const want = sig();
  return !!t && t.length === want.length && timingSafeEqual(Buffer.from(t), Buffer.from(want));
}

const OUT = new Set(["OUT", "INJURY_RESERVE", "SUSPENSION"]);
const healthy = (p: Player) => !OUT.has(p.injury);
// Last names that are also everyday words or too common to trust on their own.
const AMBIGUOUS = new Set(["green", "white", "brown", "black", "young", "love", "hart", "holiday", "allen", "johnson", "williams", "jones", "smith", "thompson", "porter", "murray", "bridges", "walker", "harris", "mitchell", "jackson", "robinson", "miller", "martin", "wells", "price", "gay", "day", "james", "george", "paul", "ball", "bey", "reed", "king"]);

/** Players named in a message: full names first, then unambiguous last names. */
export function findPlayers(text: string, players: Player[]): Player[] {
  const msg = ` ${normName(text).replace(/[^a-z0-9 ]/g, " ")} `.replace(/\s+/g, " ");
  const pool = players.filter((p) => p.team !== "FA" && fppg(p) >= 5);
  const found = new Map<number, Player>();
  for (const p of pool) if (msg.includes(` ${normName(p.name)} `)) found.set(p.id, p);
  const byLast = new Map<string, Player[]>();
  for (const p of pool) {
    const last = normName(p.name).split(" ").pop()!;
    if (last.length >= 4 && !AMBIGUOUS.has(last)) byLast.set(last, [...(byLast.get(last) ?? []), p]);
  }
  for (const [last, list] of byLast) {
    if (list.length !== 1 || found.has(list[0].id) || !msg.includes(` ${last} `)) continue;
    // A full-name match already used this word (e.g. "Jalen Williams" vs another Williams).
    if ([...found.values()].some((f) => normName(f.name).split(" ").includes(last))) continue;
    found.set(list[0].id, list[0]);
  }
  return [...found.values()];
}

const cta = (platform: string) => platform === "x"
  ? "Want the best add on your league's actual waiver wire? Free move, link in our bio."
  : `For your league's actual waiver wire: free move at ${SITE.replace(/^https?:\/\//, "")}`;
const pick = <T>(list: T[], seed: string) => list[[...seed].reduce((s, c) => s + c.charCodeAt(0), 0) % list.length];

export async function composeReply(text: string, platform: string, username = ""): Promise<string | null> {
  const [{ players }, tips] = await Promise.all([getPlayers(), teamTips().catch(() => new Map<string, number[]>())]);
  const named = findPlayers(text, players);
  if (!named.length) return null;
  const w = streamWindow();
  const games = gamesIn(tips, w);
  const g = (p: Player) => (healthy(p) ? games.get(p.team) ?? 0 : 0);
  const f = (p: Player) => round1(fppg(p));
  const last = (p: Player) => p.name.split(" ").slice(1).join(" ") || p.name;

  if (named.length >= 3) {
    const weakest = named.filter(healthy).sort((a, b) => f(a) - f(b))[0] ?? named[0];
    const adds = players
      .filter((p) => p.team !== "FA" && healthy(p) && (p.pctOwned ?? 100) < 50 && !named.some((n) => n.id === p.id) && g(p) >= 2)
      .sort((a, b) => f(b) * g(b) - f(a) * g(a));
    const top = adds[0];
    const open = pick(["Your weakest spot", "The spot I'd upgrade", "Weak link"], username + weakest.name);
    if (!top) return `${open}: ${weakest.name} (${f(weakest)} fpts/g). ${cta(platform)}`;
    const line = f(top) > f(weakest) + 1
      ? `Best add on most waiver wires: ${top.name} (${top.team}), ${f(top)} fpts/g with ${g(top)} games ${w.nextWeek ? "next week" : "left this week"}, available in ${100 - Math.round(top.pctOwned ?? 0)}% of leagues.`
      : `Nothing on most wires beats him per game. If you need games, ${top.name} has ${g(top)} ${w.nextWeek ? "next week" : "left this week"}.`;
    return `${open}: ${weakest.name} (${f(weakest)} fpts/g). ${line}\n\n${cta(platform)}`;
  }
  if (named.length === 2) {
    const [a, b] = named;
    const total = (p: Player) => f(p) * g(p);
    const [win, lose] = total(a) === total(b) ? (f(a) >= f(b) ? [a, b] : [b, a]) : total(a) > total(b) ? [a, b] : [b, a];
    const why = g(win) !== g(lose)
      ? `${g(win)} games vs ${g(lose)} ${w.nextWeek ? "next week" : "left this week"}, ${f(win)} vs ${f(lose)} fpts/g`
      : `${f(win)} vs ${f(lose)} fpts/g, same number of games`;
    const note = !healthy(lose) ? ` ${last(lose)} is out.` : lose.injury === "DAY_TO_DAY" ? ` ${last(lose)} is day-to-day.` : "";
    return `${win.name}: ${why}.${note}\n\n${cta(platform)}`;
  }
  const p = named[0];
  const mins = p.cur?.gp && p.last?.gp && Math.abs(p.cur.min - p.last.min) >= 3
    ? ` Playing ${round1(p.cur.min)} min a game (${round1(p.last.min)} last season).` : "";
  const status = !healthy(p) ? " Out right now." : p.injury === "DAY_TO_DAY" ? " Day-to-day." : "";
  const verdict = (p.pctOwned ?? 100) < 50 && f(p) >= 25 && healthy(p) ? " Worth an add." : "";
  return `${p.name}: ${f(p)} fpts/g, ${g(p)} games ${w.nextWeek ? "next week" : "left this week"}.${mins}${status}${verdict}\n\n${cta(platform)}`;
}
