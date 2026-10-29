import { NextResponse } from "next/server";
import { alertText, detectBreaking, sendBreaking } from "@/lib/breaking";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Vercel Cron, every 10 minutes: alert on widely rostered players newly ruled out. `?dry=1` previews without sending. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const dry = new URL(req.url).searchParams.get("dry") === "1";
    const { events, seeded } = await detectBreaking(Date.now(), dry);
    if (dry) return NextResponse.json({ seeded, events, texts: events.map((e) => alertText(e)) });
    const sent = await sendBreaking(events);
    return NextResponse.json({ seeded, events: events.length, ...sent });
  } catch (e) {
    console.error("[breaking]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
