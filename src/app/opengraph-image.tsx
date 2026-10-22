import { ImageResponse } from "next/og";
import { seasonMode } from "@/lib/season";

export const alt = "Takeover Fantasy: daily add/drops and rankings for your fantasy basketball league";
// Re-render hourly so the season version takes over by itself (see seasonMode).
export const revalidate = 3600;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The preview card shown when a Takeover Fantasy link is shared in iMessage, Discord, X and so on. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#faf8f7", padding: 80 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg viewBox="0 0 100 100" width="88" height="88">
      <rect width="100" height="100" rx="23" fill="#191919" />
      <circle cx="50" cy="50" r="30" fill="none" stroke="#faf8f7" strokeWidth="6" />
      <path d="M23 65C44 65 52 40 80 25M76.1 36.4L80 25L68.4 21.9" fill="none" stroke="#191919" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M23 65C44 65 52 40 80 25M76.1 36.4L80 25L68.4 21.9" fill="none" stroke="#3fa37a" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
          <div style={{ fontSize: 48, fontWeight: 600, color: "#191919", letterSpacing: -1 }}>Takeover Fantasy</div>
        </div>
        {seasonMode() ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 76, fontWeight: 600, color: "#191919", letterSpacing: -2.5, lineHeight: 1.05 }}>Your best add/drops,</div>
            <div style={{ fontSize: 76, fontWeight: 600, color: "#8a8988", letterSpacing: -2.5, lineHeight: 1.05 }}>every morning.</div>
            <div style={{ marginTop: 28, fontSize: 30, color: "#525252" }}>Fantasy basketball · usable games · injury alerts with the pickup</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 76, fontWeight: 600, color: "#191919", letterSpacing: -2.5, lineHeight: 1.05 }}>Rankings for your league,</div>
            <div style={{ fontSize: 76, fontWeight: 600, color: "#8a8988", letterSpacing: -2.5, lineHeight: 1.05 }}>not ESPN&apos;s default.</div>
            <div style={{ marginTop: 28, fontSize: 30, color: "#525252" }}>Fantasy basketball draft kit · mock drafts · live ESPN draft sync</div>
          </div>
        )}
      </div>
    ),
    size,
  );
}
