import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LogoMark } from "@/components/Logo";
import { isOwner } from "@/lib/auth";
import { funnelReport, type FunnelStep } from "@/lib/funnel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Funnel · Takeover Fantasy", robots: { index: false } };

const LABEL: Record<FunnelStep, string> = {
  visit: "Visited",
  league_found: "Pasted a league",
  league_connected: "Connected a league",
  preview_seen: "Saw the free move",
  checkout_click: "Clicked checkout",
  purchase: "Paid",
};

const rate = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "–");

/** Owner-only: where visitors drop off on the way to paying, and where they come from. */
export default async function Funnel({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  if (!(await isOwner())) notFound();
  const days = Math.min(90, Math.max(1, Number((await searchParams).days) || 14));
  const r = await funnelReport(days);
  const top = r.steps[0].visitors;
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/" className="flex items-center gap-2 text-sm font-semibold"><LogoMark size={20} /> Takeover Fantasy</Link>
      <h1 className="mt-6 text-3xl font-medium tracking-[-0.03em]">Funnel</h1>
      <p className="mt-2 text-sm text-muted">
        Unique visitors per step, last {days} days.{" "}
        {[7, 14, 30].map((d) => <Link key={d} href={`/funnel?days=${d}`} className={`mr-2 underline-offset-2 hover:underline ${d === days ? "font-medium text-fg" : ""}`}>{d}d</Link>)}
      </p>

      <section className="mt-8 rounded-xl border border-line bg-panel p-4">
        {r.steps.map((s, i) => (
          <div key={s.step} className="flex items-center gap-4 border-t border-line py-3 first:border-t-0">
            <div className="w-44 shrink-0 text-sm">{LABEL[s.step]}</div>
            <div className="h-2 flex-1 rounded-full bg-sunken">
              <div className="h-2 rounded-full bg-fg" style={{ width: top ? `${Math.max(2, (s.visitors / top) * 100)}%` : 0 }} />
            </div>
            <div className="w-12 text-right text-sm font-medium tabular-nums">{s.visitors}</div>
            <div className="w-14 text-right text-xs text-muted tabular-nums">{i ? rate(s.visitors, r.steps[i - 1].visitors) : ""}</div>
          </div>
        ))}
      </section>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <section className="rounded-xl border border-line bg-panel p-4">
          <h2 className="mb-2 text-sm font-medium">Sources</h2>
          <table className="w-full text-sm tabular-nums">
            <thead className="text-xs text-muted"><tr><th className="py-1 text-left font-normal">From</th><th className="text-right font-normal">Visitors</th><th className="text-right font-normal">Connected</th><th className="text-right font-normal">Paid</th></tr></thead>
            <tbody>
              {r.sources.map((s) => <tr key={s.src} className="border-t border-line"><td className="py-1.5">{s.src}</td><td className="text-right">{s.visitors}</td><td className="text-right">{s.connected}</td><td className="text-right">{s.paid}</td></tr>)}
            </tbody>
          </table>
        </section>
        <section className="rounded-xl border border-line bg-panel p-4">
          <h2 className="mb-2 text-sm font-medium">Countries</h2>
          <table className="w-full text-sm tabular-nums">
            <tbody>
              {r.countries.map((c) => <tr key={c.country} className="border-t border-line first:border-t-0"><td className="py-1.5">{c.country}</td><td className="text-right">{c.visitors}</td></tr>)}
            </tbody>
          </table>
        </section>
      </div>

      <section className="mt-8 overflow-x-auto rounded-xl border border-line bg-panel p-4">
        <h2 className="mb-2 text-sm font-medium">By day</h2>
        <table className="w-full text-sm tabular-nums">
          <thead className="text-xs text-muted"><tr><th className="py-1 text-left font-normal">Date</th>{r.steps.map((s) => <th key={s.step} className="text-right font-normal">{LABEL[s.step].split(" ").pop()}</th>)}</tr></thead>
          <tbody>
            {r.daily.map((d) => <tr key={d.date} className="border-t border-line"><td className="py-1.5">{d.date}</td>{r.steps.map((s) => <td key={s.step} className="text-right">{d.counts[s.step]}</td>)}</tr>)}
          </tbody>
        </table>
      </section>
      <p className="mt-4 text-xs text-muted">Counting started when this page shipped; Vercel Analytics has older visit totals.</p>
    </main>
  );
}
