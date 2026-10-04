export interface NewsItem {
  id: number;
  playerId: number;
  /** What happened. */
  headline: string;
  /** Fantasy analysis of it. */
  analysis: string;
  published: string;
  source: string;
}

const NEWS = "https://site.api.espn.com/apis/fantasy/v2/games/fba/news/players";

/** Latest news items for one player from ESPN's fantasy news feed. Cached for 15 minutes. */
export async function fetchPlayerNews(playerId: number, limit = 6): Promise<NewsItem[]> {
  try {
    const r = await fetch(`${NEWS}?playerId=${playerId}&limit=${limit}`, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; TakeoverFantasy/0.1)" },
      next: { revalidate: 60 * 15 },
    });
    if (!r.ok) return [];
    const j = await r.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((j?.feed ?? []) as any[])
      .filter((x) => x?.headline)
      .map((x) => ({
        id: Number(x.id),
        playerId: Number(x.playerId ?? playerId),
        headline: String(x.headline),
        analysis: String(x.story ?? ""),
        published: String(x.published ?? x.lastModified ?? ""),
        source: String(x.type ?? "ESPN"),
      }));
  } catch {
    return [];
  }
}
