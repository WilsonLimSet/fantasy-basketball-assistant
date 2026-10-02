import { fetchAges, fetchEspnPlayers, parsePlayers } from "./espn";
import type { Player } from "./types";

export const SEASON = Number(process.env.CV_SEASON ?? 2027); // ESPN uses the ending year (2026-27 => 2027)

let cache: { at: number; players: Player[]; source: string; outlooks: Map<number, string> } | null = null;
const TTL = 1000 * 60 * 60 * 3;

/** Player pool, cached in memory per server instance (ESPN fetch is also cached by Next). */
export async function getPlayers() {
  if (cache && Date.now() - cache.at < TTL) return cache;
  let players: Player[], source: string;
  let outlooks = new Map<number, string>();
  if (process.env.CV_MOCK_FILE) {
    const fs = await import("node:fs/promises");
    players = parsePlayers(JSON.parse(await fs.readFile(process.env.CV_MOCK_FILE, "utf8")), SEASON, outlooks);
    source = "mock";
  } else {
    const [fetched, ages] = await Promise.all([fetchEspnPlayers(SEASON), fetchAges()]);
    ({ players, source, outlooks } = fetched);
    for (const p of players) p.age = ages.get(p.id) ?? null;
  }
  cache = { at: Date.now(), players, source, outlooks };
  return cache;
}
