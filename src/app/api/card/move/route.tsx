import { ImageResponse } from "next/og";
import { headshotUrl } from "@/lib/espnImages";
import { rateMove, type MoveSide, type Verdict } from "@/lib/moveRater";
import { SITE } from "@/lib/social";

const INK = "#191919", MUTED = "#6b6a69", LINE = "#e7e4e1", BG = "#faf8f7", PANEL = "#ffffff", GREEN = "#2f7d5d", RED = "#b42318";
const MARK = (
  <svg viewBox="0 0 100 100" width="44" height="44">
    <rect width="100" height="100" rx="23" fill="#191919" />
    <circle cx="50" cy="50" r="30" fill="none" stroke="#faf8f7" strokeWidth="6" />
    <path d="M23 65C44 65 52 40 80 25M76.1 36.4L80 25L68.4 21.9" fill="none" stroke="#191919" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M23 65C44 65 52 40 80 25M76.1 36.4L80 25L68.4 21.9" fill="none" stroke="#3fa37a" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const VERDICT: Record<Verdict, { text: string; color: string }> = {
  make: { text: "Make the move", color: GREEN },
  stream: { text: "This week only", color: INK },
  close: { text: "Close call", color: INK },
  keep: { text: "Keep him", color: RED },
};

function Side({ label, s, win }: { label: string; s: MoveSide; win: boolean }) {
  return (
    <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 22, background: PANEL, border: `2px solid ${win ? INK : LINE}`, borderRadius: 24, padding: 20 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={headshotUrl(s.id, 260, 190)} width={150} height={110} alt="" style={{ borderRadius: 16, background: BG }} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 20, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: label === "Add" ? GREEN : RED }}>{label}</div>
        <div style={{ display: "flex", fontSize: s.name.length > 15 ? 32 : 38, fontWeight: 700, letterSpacing: -1, marginTop: 4 }}>{s.name}</div>
        <div style={{ display: "flex", fontSize: 22, color: MUTED, marginTop: 6 }}>{`${s.fppg} fpts/g · ${s.games} game${s.games === 1 ? "" : "s"} left`}</div>
      </div>
    </div>
  );
}

/** GET /api/card/move?drop=<id>&add=<id>: the share card (1200x630) for a rated waiver move. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const n = (k: string) => (/^\d{1,9}$/.test(q.get(k) ?? "") ? Number(q.get(k)) : 0);
  const r = await rateMove(n("drop"), n("add")).catch(() => null);
  if (!r) return new Response("Unknown players", { status: 404 });
  const v = VERDICT[r.verdict];
  const addWins = r.verdict === "make" || r.verdict === "stream";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: BG, padding: "52px 60px", fontFamily: "sans-serif", color: INK }}>
        <div style={{ display: "flex", alignItems: "center", fontSize: 24, color: MUTED }}>
          <div style={{ display: "flex", background: INK, color: "#fff", borderRadius: 999, padding: "8px 20px", fontSize: 22, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>Rate my move</div>
          <div style={{ display: "flex", marginLeft: "auto" }}>{r.window}</div>
        </div>
        <div style={{ display: "flex", fontSize: 76, fontWeight: 700, letterSpacing: -3, color: v.color, marginTop: 30, lineHeight: 1 }}>{v.text}</div>
        <div style={{ display: "flex", fontSize: 26, color: MUTED, marginTop: 14 }}>{r.reasons[0]}</div>
        <div style={{ display: "flex", gap: 24, marginTop: "auto" }}>
          <Side label="Drop" s={r.drop} win={!addWins && r.verdict !== "close"} />
          <Side label="Add" s={r.add} win={addWins} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 28, fontSize: 24, color: MUTED }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>{MARK}<span>{`${SITE.replace(/^https?:\/\//, "")}/move`}</span></div>
          <span>Rate yours, free</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
