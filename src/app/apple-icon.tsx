import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon (iOS). Same mark as icon.svg, drawn edge to edge since iOS rounds the corners. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#191919" }}>
        <svg viewBox="0 0 64 64" width="180" height="180">
          <path d="M32 4v56" stroke="#faf8f7" strokeWidth="4.5" strokeLinecap="round" />
          <circle cx="32" cy="32" r="14" fill="#191919" stroke="#faf8f7" strokeWidth="4.5" />
          <circle cx="32" cy="32" r="5" fill="#3fa37a" />
        </svg>
      </div>
    ),
    size,
  );
}
