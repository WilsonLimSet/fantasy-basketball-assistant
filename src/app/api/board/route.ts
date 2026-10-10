import { NextResponse } from "next/server";
import { getPlayers, SEASON } from "@/lib/data";
import { League, valuePlayers } from "@/lib/engine";
import { currentAccount, currentPass, FREE_LIMIT, PAYWALL_ON } from "@/lib/auth";
import { AUTH_ON } from "@/lib/supabase/env";
import { loadTakes } from "@/lib/takes";

/** Valued player board for a league config. Free users get the top FREE_LIMIT only. */
export async function POST(req: Request) {
  try {
    const league = (await req.json().catch(() => null)) as League | null;
    if (!league?.slots || !league.teams) return NextResponse.json({ error: "bad league" }, { status: 400 });
    const [{ players, source, at }, pass, account, takeSet] = await Promise.all([getPlayers(), currentPass(), currentAccount(), loadTakes()]);
    const all = valuePlayers(players, league);
    const paid = !!pass || !PAYWALL_ON;
    return NextResponse.json({
      season: SEASON, source, takesUpdated: takeSet.updatedAt, espnAt: new Date(at).toISOString(),
      paid, pro: !!pass, email: pass?.email ?? null,
      authOn: AUTH_ON, account: account?.email ?? null,
      total: all.length, freeLimit: FREE_LIMIT,
      // Prefill the signed-in email so the purchase links to the account automatically.
      paymentLink: process.env.STRIPE_PAYMENT_LINK
        ? process.env.STRIPE_PAYMENT_LINK + (account ? `?prefilled_email=${encodeURIComponent(account.email)}` : "")
        : null,
      priceLabel: process.env.CV_PRICE_LABEL ?? "$19 season pass",
      valued: paid ? all : all.slice(0, FREE_LIMIT),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
