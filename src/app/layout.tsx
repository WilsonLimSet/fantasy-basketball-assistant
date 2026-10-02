import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CourtVision · Fantasy Basketball Draft Assistant",
  description: "Draft rankings and a live draft board tuned to your exact ESPN or Yahoo league scoring.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
