import { ImageResponse } from "next/og";
import { parseMockShare } from "@/lib/shareCard";

const MARK = (
  <svg viewBox="0 0 64 64" width="56" height="56">
    <rect width="64" height="64" rx="15" fill="#191919" />
    <path d="M32 6v52" stroke="#faf8f7" strokeWidth="5" strokeLinecap="round" />
    <circle cx="32" cy="32" r="15" fill="#191919" stroke="#faf8f7" strokeWidth="5" />
    <circle cx="32" cy="32" r="5.5" fill="#3fa37a" />
  </svg>
);

/** GET /api/card/mock?g=A&p=1&n=10&s=Points&b=Name&bd=41&r=A|B|C: the shareable mock-draft result image. */
export async function GET(req: Request) {
  const m = parseMockShare(new URL(req.url).searchParams);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#faf8f7", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {MARK}
            <div style={{ fontSize: 38, fontWeight: 600, color: "#191919" }}>CourtVision</div>
            <div style={{ fontSize: 26, color: "#8a8988", marginLeft: 8 }}>Mock draft</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 48, marginTop: 64 }}>
            <div style={{ width: 220, height: 220, borderRadius: 110, background: "#191919", color: "#faf8f7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 120, fontWeight: 600 }}>
              {m.grade}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 64, fontWeight: 600, color: "#191919", letterSpacing: -2 }}>{`Finished #${m.place} of ${m.teams}`}</div>
              <div style={{ fontSize: 30, color: "#525252", marginTop: 8 }}>{`${m.teams}-team ${m.scoring} league`}</div>
              {m.steal && (
                <div style={{ display: "flex", marginTop: 26, fontSize: 30, color: "#191919" }}>
                  <span style={{ color: "#2f7d5d", fontWeight: 600, marginRight: 12 }}>Steal:</span>
                  <span>{`${m.steal}${m.stealBy ? `, ${m.stealBy} picks after his value` : ""}`}</span>
                </div>
              )}
            </div>
          </div>
          {m.picks.length > 0 && (
            <div style={{ display: "flex", marginTop: "auto", fontSize: 26, color: "#525252" }}>
              {`Core: ${m.picks.join(" · ")}`}
            </div>
          )}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
