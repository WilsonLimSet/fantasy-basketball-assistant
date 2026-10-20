import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { scorecards } from "@/lib/scorecard";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Receipts · Takeover Fantasy",
  description: "Every week: our streaming picks vs ESPN's most-added players, scored in fantasy points per game.",
  openGraph: { images: [{ url: "/api/card/social?type=scorecard", width: 1080, height: 1350 }] },
};

/** Public receipts: how each week's streaming picks did against ESPN's most-added players. */
export default async function Scorecard() {
  const weeks = await scorecards().catch(() => []);
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/" className="flex items-center gap-2 text-sm font-semibold"><LogoMark size={20} /> Takeover Fantasy</Link>
      <h1 className="mt-8 text-3xl font-medium tracking-[-0.03em]">Receipts</h1>
      <p className="mt-2 text-sm text-muted">
        Every Monday we save our top 10 streamers and ESPN&apos;s 10 most-added players. Here&apos;s how many fantasy points per game
        (ESPN default scoring) each group scored after that. Good weeks and bad ones.
      </p>
      {weeks.length === 0 && <p className="mt-8 text-sm text-muted">The first week&apos;s picks are in. Results show up as games are played.</p>}
      {weeks.map((w) => {
        const beat = w.ours.fppg >= w.espn.fppg;
        return (
          <section key={w.week} className="mt-8 rounded-xl border border-line bg-panel p-5 shadow-[0_1px_2px_rgba(25,25,25,0.04)]">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-medium">Week {w.week}</h2>
              <span className="text-xs text-muted">{w.complete ? "Final" : "In progress"}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[{ k: "Our picks", v: w.ours, hi: beat }, { k: "ESPN most added", v: w.espn, hi: !beat }].map((x) => (
                <div key={x.k} className={`rounded-lg border p-4 ${x.hi ? "border-fg" : "border-line"}`}>
                  <div className="text-[11px] uppercase tracking-wide text-muted">{x.k}</div>
                  <div className="mt-1 text-3xl font-medium tabular-nums tracking-tight">{x.v.fppg.toFixed(1)}</div>
                  <div className="text-xs text-muted">fpts/g · {x.v.games} games</div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-6 text-sm sm:grid-cols-2">
              {[{ k: "Our picks", v: w.ours }, { k: "ESPN most added", v: w.espn }].map((x) => (
                <ul key={x.k}>
                  {x.v.players.map((p) => (
                    <li key={p.id} className="flex justify-between border-t border-line py-1.5 first:border-t-0">
                      <span className="truncate">{p.name}</span>
                      <span className="tabular-nums text-muted">{p.games ? `${p.fppg.toFixed(1)} · ${p.games}G` : "–"}</span>
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </section>
        );
      })}
      <Link href="/inseason" className="mt-10 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-ink/85">
        Get picks built for your roster →
      </Link>
    </main>
  );
}
