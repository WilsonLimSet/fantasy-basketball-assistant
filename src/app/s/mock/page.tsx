import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { mockShareQuery, parseMockShare } from "@/lib/shareCard";

type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const m = parseMockShare(await searchParams);
  const title = `${m.grade} mock draft: #${m.place} of ${m.teams} · CourtVision`;
  const image = `/api/card/mock?${mockShareQuery(m)}`;
  return {
    title,
    description: "Mock drafted with CourtVision, the fantasy basketball draft kit that knows your league.",
    openGraph: { title, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, images: [image] },
  };
}

/** A shared mock-draft result. The link preview is the card image; the page invites the viewer to try. */
export default async function SharedMock({ searchParams }: { searchParams: Search }) {
  const m = parseMockShare(await searchParams);
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/" className="flex items-center gap-2 text-sm font-semibold"><LogoMark size={20} /> CourtVision</Link>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/card/mock?${mockShareQuery(m)}`} alt={`Mock draft grade ${m.grade}, finished ${m.place} of ${m.teams}`} className="mt-6 w-full rounded-2xl border border-line shadow-[0_20px_60px_rgba(25,25,25,0.10)]" />
      <h1 className="mt-8 text-3xl font-medium tracking-[-0.03em]">Think you can beat a {m.grade}?</h1>
      <p className="mt-2 text-sm text-muted">
        Run a mock against CPU teams that draft like real ESPN users, or like your actual league mates. Free, no account needed.
      </p>
      <Link href="/draft" className="mt-6 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-ink/85">Run your own mock →</Link>
    </main>
  );
}
