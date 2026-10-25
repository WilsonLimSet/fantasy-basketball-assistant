import { NextResponse } from "next/server";
import { composeReply, validReplyToken } from "@/lib/replyBot";

/** POST /api/reply?t=<token> {platform, text, username}: Postroom's reply hook (see src/lib/replyBot.ts). */
export async function POST(req: Request) {
  if (!validReplyToken(new URL(req.url).searchParams.get("t"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (!b || typeof b.text !== "string") return NextResponse.json({ reply: null });
  const platform = b.platform === "x" ? "x" : "threads";
  const reply = await composeReply(b.text.slice(0, 1000), platform, typeof b.username === "string" ? b.username : "").catch((e) => {
    console.error("[reply]", e);
    return null;
  });
  return NextResponse.json({ reply });
}
