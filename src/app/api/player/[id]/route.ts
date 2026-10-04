import { NextResponse } from "next/server";
import { getPlayers, SEASON } from "@/lib/data";
import { fetchPlayerNews } from "@/lib/playerNews";

/** Notes for one player: ESPN's season outlook and the latest news items. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "bad id" }, { status: 400 });
  try {
    const [{ outlooks }, news] = await Promise.all([getPlayers(), fetchPlayerNews(id)]);
    return NextResponse.json({ id, season: SEASON, outlook: outlooks.get(id) ?? null, news });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
