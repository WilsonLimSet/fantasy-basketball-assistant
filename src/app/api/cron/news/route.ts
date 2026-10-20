import { NextResponse } from "next/server";
import { ingestNews, summarizeMissing } from "@/lib/autoTakes";
import { getPlayers } from "@/lib/data";
import { pushSocial } from "@/lib/socialPush";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Vercel Cron (twice a day): turn new ESPN player news into takes, republish them, and send new social posts. `?dry=1` previews without publishing. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const dryRun = new URL(req.url).searchParams.get("dry") === "1";
    const ingest = await ingestNews({ dryRun });
    if (dryRun) return NextResponse.json(ingest);
    // Our own summaries for the news the app shows: the Latest feed and every player sheet (top 300).
    const { players } = await getPlayers();
    const shown = players.filter((p) => p.lastNews).sort((a, b) => (b.lastNews ?? 0) - (a.lastNews ?? 0)).slice(0, 60).map((p) => p.id);
    const summaries = await summarizeMissing(shown, 3).catch((e) => { console.error("[news cron] summaries:", e); return { written: 0 }; });
    // New takes are live; turn the big ones into social posts.
    const social = await pushSocial().catch((e) => { console.error("[news cron] social:", e); return null; });
    return NextResponse.json({ ...ingest, summaries, social });
  } catch (e) {
    console.error("[news cron]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
