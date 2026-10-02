import { NextResponse } from "next/server";
import { getPlayers, SEASON } from "@/lib/data";
import { League, valuePlayers } from "@/lib/engine";
import { currentPass, FREE_LIMIT, PAYWALL_ON } from "@/lib/auth";
import { TAKES_UPDATED } from "@/lib/takes";

/** Valued player board for a league config. Free users get the top FREE_LIMIT only. */
export async function POST(req: Request) {
  try {
    const league = (await req.json()) as League;
    if (!league?.slots || !league.teams) return NextResponse.json({ error: "bad league" }, { status: 400 });
    const [{ players, source }, pass] = await Promise.all([getPlayers(), currentPass()]);
    const all = valuePlayers(players, league);
    const paid = !!pass || !PAYWALL_ON;
    return NextResponse.json({
      season: SEASON, source, takesUpdated: TAKES_UPDATED,
      paid, pro: !!pass, email: pass?.email ?? null,
      total: all.length, freeLimit: FREE_LIMIT,
      paymentLink: process.env.STRIPE_PAYMENT_LINK ?? null,
      priceLabel: process.env.CV_PRICE_LABEL ?? "$19 season pass",
      valued: paid ? all : all.slice(0, FREE_LIMIT),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
