import { ImageResponse } from "next/og";

export const alt = "Takeover Fantasy: fantasy basketball rankings for your league";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The preview card shown when a Takeover Fantasy link is shared in iMessage, Discord, X and so on. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#faf8f7", padding: 80 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg viewBox="0 0 64 64" width="88" height="88">
            <rect width="64" height="64" rx="15" fill="#191919" />
            <path d="M32 6v52" stroke="#faf8f7" strokeWidth="5" strokeLinecap="round" />
            <circle cx="32" cy="32" r="15" fill="#191919" stroke="#faf8f7" strokeWidth="5" />
            <circle cx="32" cy="32" r="5.5" fill="#3fa37a" />
          </svg>
          <div style={{ fontSize: 48, fontWeight: 600, color: "#191919", letterSpacing: -1 }}>Takeover Fantasy</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, fontWeight: 600, color: "#191919", letterSpacing: -2.5, lineHeight: 1.05 }}>Rankings for your league,</div>
          <div style={{ fontSize: 76, fontWeight: 600, color: "#8a8988", letterSpacing: -2.5, lineHeight: 1.05 }}>not ESPN&apos;s default.</div>
          <div style={{ marginTop: 28, fontSize: 30, color: "#525252" }}>Fantasy basketball draft kit · mock drafts · live ESPN draft sync</div>
        </div>
      </div>
    ),
    size,
  );
}
