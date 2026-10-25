import { NextResponse } from "next/server";
import { isFunnelStep, recordFunnel } from "@/lib/funnel";

/** POST {step, vid, src}: one funnel step for an anonymous visitor id (see src/lib/funnel.ts). */
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b || !isFunnelStep(b.step) || typeof b.vid !== "string" || !/^[a-z0-9]{8,40}$/i.test(b.vid)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  // Purchases are only recorded by the server, from a verified Stripe checkout.
  if (b.step === "purchase") return NextResponse.json({ ok: false }, { status: 400 });
  const src = typeof b.src === "string" ? b.src.replace(/[^a-z0-9.-]/gi, "").slice(0, 40) : "";
  await recordFunnel(b.step, b.vid, src, req.headers.get("x-vercel-ip-country") ?? "").catch((e) => console.error("[funnel]", e));
  return NextResponse.json({ ok: true });
}
