import { NextResponse } from "next/server";
import { ingestNews } from "@/lib/autoTakes";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Vercel Cron (twice a day): turn new ESPN player news into takes and republish them. `?dry=1` previews without publishing. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const dryRun = new URL(req.url).searchParams.get("dry") === "1";
    return NextResponse.json(await ingestNews({ dryRun }));
  } catch (e) {
    console.error("[news cron]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
