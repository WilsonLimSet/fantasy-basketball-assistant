import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { movePlayers, rateMove, type Verdict } from "@/lib/moveRater";
import { MovePicker } from "./MovePicker";

export const dynamic = "force-dynamic";

type Search = Promise<Record<string, string | string[] | undefined>>;
const ids = async (s: Search) => {
  const q = await s;
  const n = (v: unknown) => (typeof v === "string" && /^\d{1,9}$/.test(v) ? Number(v) : null);
  return { drop: n(q.drop), add: n(q.add) };
};

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const { drop, add } = await ids(searchParams);
  const r = drop && add ? await rateMove(drop, add).catch(() => null) : null;
  const title = r ? `Drop ${r.drop.name}, add ${r.add.name}? · Takeover Fantasy` : "Rate my waiver move · Takeover Fantasy";
  const description = r ? r.headline : "Drop one player, add another: get a verdict in seconds. Free fantasy basketball tool.";
  const image = r ? `/api/card/move?drop=${r.drop.id}&add=${r.add.id}` : undefined;
  return {
    title, description,
    openGraph: { title, description, ...(image ? { images: [{ url: image, width: 1200, height: 630 }] } : {}) },
    twitter: { card: "summary_large_image", title, description, ...(image ? { images: [image] } : {}) },
  };
}

const TONE: Record<Verdict, string> = { make: "text-[#2f7d5d]", stream: "text-fg", close: "text-fg", keep: "text-[#b42318]" };

/** Public "rate my move": a league-wide verdict, shareable as a link with a card preview. */
export default async function Move({ searchParams }: { searchParams: Search }) {
  const { drop, add } = await ids(searchParams);
  const [players, r] = await Promise.all([
    movePlayers().catch(() => []),
    drop && add ? rateMove(drop, add).catch(() => null) : null,
  ]);
  const pick = (id: number | null) => players.find((p) => p.id === id);
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/" className="flex items-center gap-2 text-sm font-semibold"><LogoMark size={20} /> Takeover Fantasy</Link>
      <h1 className="mt-8 text-3xl font-medium tracking-[-0.03em]">Rate my waiver move</h1>
      <p className="mt-2 text-sm text-muted">Pick who you&apos;d drop and who you&apos;d add. Free, no account.</p>
      <MovePicker players={players} drop={pick(drop)} add={pick(add)} />

      {r && (
        <section className="mt-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/card/move?drop=${r.drop.id}&add=${r.add.id}`} alt={r.headline} className="w-full rounded-2xl border border-line shadow-[0_20px_60px_rgba(25,25,25,0.10)]" />
          <h2 className={`mt-6 text-2xl font-medium tracking-[-0.02em] ${TONE[r.verdict]}`}>{r.headline}</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {r.reasons.map((x) => <li key={x} className="flex gap-2"><span className="text-muted">·</span>{x}</li>)}
          </ul>
          <p className="mt-4 text-xs text-muted">Share this page: the link previews as the card above.</p>
          <div className="mt-8 rounded-xl border border-line bg-panel p-5">
            <div className="text-sm font-medium">Is {r.add.name} even the best add in your league?</div>
            <p className="mt-1 text-sm text-muted">Every league&apos;s waiver wire is different. Connect yours and get the best moves for your roster, free to try.</p>
            <Link href="/inseason" className="mt-4 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-ink/85">Get my league&apos;s moves →</Link>
          </div>
        </section>
      )}
      {(drop || add) && !r && <p className="mt-8 text-sm text-muted">Couldn&apos;t rate that one. Pick two different players.</p>}
    </main>
  );
}
