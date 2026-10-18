import { NextResponse } from "next/server";
import { SEASON } from "@/lib/data";
import { espnPlayerUrl, fetchPlayerNews, loadNewsSummaries, newsCards } from "@/lib/playerNews";

/** Latest news for one player, as our own summaries with links to ESPN (never ESPN's text). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "bad id" }, { status: 400 });
  try {
    const [news, summaries] = await Promise.all([fetchPlayerNews(id), loadNewsSummaries()]);
    return NextResponse.json({ id, season: SEASON, espnUrl: espnPlayerUrl(id), news: newsCards(news, summaries) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
