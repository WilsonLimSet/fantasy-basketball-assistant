import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon (iOS). Same mark as icon.svg, drawn edge to edge since iOS rounds the corners. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#191919" }}>
        <svg viewBox="0 0 100 100" width="180" height="180">
          <circle cx="50" cy="50" r="30" fill="none" stroke="#faf8f7" strokeWidth="6" />
          <path d="M23 65C44 65 52 40 80 25M76.1 36.4L80 25L68.4 21.9" fill="none" stroke="#191919" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M23 65C44 65 52 40 80 25M76.1 36.4L80 25L68.4 21.9" fill="none" stroke="#3fa37a" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    size,
  );
}
