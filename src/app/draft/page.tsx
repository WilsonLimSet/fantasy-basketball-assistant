import type { Metadata } from "next";
import App from "@/components/App";
import { seasonMode } from "@/lib/season";

export const metadata: Metadata = { title: "Draft Kit · Takeover Fantasy" };

// Re-render hourly so season mode switches on by itself.
export const revalidate = 3600;

export default function DraftPage() {
  return <App season={seasonMode()} />;
}
