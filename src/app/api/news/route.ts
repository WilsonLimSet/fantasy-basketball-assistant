import { NextResponse } from "next/server";
import { getPlayers } from "@/lib/data";
import { fetchPlayerNews } from "@/lib/playerNews";
import { loadTakes } from "@/lib/takes";

const LATEST_PLAYERS = 24;

/** The news feed: our sourced takes plus the latest player news around the league (free; it's the marketing). */
export async function GET() {
  let latest: unknown[] = [];
  try {
    const { players } = await getPlayers();
    const recent = players.filter((p) => p.lastNews).sort((a, b) => (b.lastNews ?? 0) - (a.lastNews ?? 0)).slice(0, LATEST_PLAYERS);
    const feeds = await Promise.all(recent.map((p) => fetchPlayerNews(p.id, 1)));
    latest = feeds
      .flatMap((items, i) => items.slice(0, 1).map((n) => {
        const p = recent[i];
        return { ...n, name: p.name, team: p.team, pos: p.pos, injury: p.injury };
      }))
      .sort((a, b) => b.published.localeCompare(a.published));
  } catch { /* the takes feed still works without live news */ }
  const { takes, updatedAt } = await loadTakes();
  return NextResponse.json({ updatedAt, takes, latest });
}
