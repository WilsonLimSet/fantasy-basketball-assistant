import { NextResponse } from "next/server";
import { getPlayers, SEASON } from "@/lib/data";
import { League, valuePlayers } from "@/lib/engine";
import { currentAccount, FREE_LIMIT } from "@/lib/auth";
import { AUTH_ON } from "@/lib/supabase/env";
import { loadTakes } from "@/lib/takes";

/** Valued player board for a league config. The draft kit is free, so everyone gets every player. */
export async function POST(req: Request) {
  try {
    const league = (await req.json().catch(() => null)) as League | null;
    if (!league?.slots || !league.teams) return NextResponse.json({ error: "bad league" }, { status: 400 });
    const [{ players, source, at }, account, takeSet] = await Promise.all([getPlayers(), currentAccount(), loadTakes()]);
    const all = valuePlayers(players, league);
    const paid = true;
    return NextResponse.json({
      season: SEASON, source, takesUpdated: takeSet.updatedAt, espnAt: new Date(at).toISOString(),
      paid, pro: false, email: null,
      authOn: AUTH_ON, account: account?.email ?? null,
      total: all.length, freeLimit: FREE_LIMIT,
      paymentLink: null,
      priceLabel: "",
      valued: all,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
