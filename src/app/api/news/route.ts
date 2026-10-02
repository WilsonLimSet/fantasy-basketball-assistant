import { NextResponse } from "next/server";
import { TAKES, TAKES_UPDATED } from "@/lib/takes";

/** The daily news -> fantasy impact feed (free; it's the marketing). */
export async function GET() {
  return NextResponse.json({ updatedAt: TAKES_UPDATED, takes: TAKES });
}
