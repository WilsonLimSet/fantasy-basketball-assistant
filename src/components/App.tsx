"use client";

import { useEffect, useMemo, useState } from "react";
import { applyMyRanks, useMyRanks } from "@/lib/myRanks";
import Link from "next/link";
import { LogoMark } from "./Logo";
import { League, leagueFromPreset, Valued } from "@/lib/engine";
import { DraftState } from "@/lib/draft";
import Rankings from "./Rankings";
import DraftBoard from "./DraftBoard";
import MockDraft from "./MockDraft";
import FormatEdges from "./FormatEdges";
import CheatSheet from "./CheatSheet";
import LeagueSettings from "./LeagueSettings";
import News from "./News";
import { PassInfo } from "./Paywall";
import { PlayerSheetProvider } from "./PlayerSheet";
import { ScoutingProvider } from "@/lib/scouting";

type Tab = "kit" | "mock" | "draft" | "sheet" | "news" | "edges" | "settings";

export interface Board extends PassInfo {
  season: number;
  source: string;
  takesUpdated: string;
  valued: Valued[];
}

function load<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ }
}

export default function App() {
  const [rawBoard, setBoard] = useState<Board | null>(null);
  const myRanks = useMyRanks();
  // Your own ranks re-order the board everywhere: rankings, mocks, live draft.
  const board = useMemo(() => (rawBoard ? { ...rawBoard, valued: applyMyRanks(rawBoard.valued, myRanks) } : null), [rawBoard, myRanks]);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("kit");
  const [league, setLeague] = useState<League>(() => leagueFromPreset("espn-points", 10));
  const [draft, setDraft] = useState<DraftState>({ mySlot: 1, rounds: 13, picks: [] });
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLeague(load("cv.league", leagueFromPreset("espn-points", 10)));
    setDraft(load("cv.draft", { mySlot: 1, rounds: 13, picks: [] }));
    setTab(load<Tab>("cv.tab", "kit"));
    setHydrated(true);
  }, []);

  // Re-value the board on the server whenever league settings change.
  useEffect(() => {
    if (!hydrated) return;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      fetch("/api/board", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(league),
        signal: ctl.signal,
      })
        .then(async (r) => {
          const j = await r.json();
          if (!r.ok) throw new Error(j.error ?? r.statusText);
          setBoard(j);
          setErr(null);
        })
        .catch((e) => { if (e.name !== "AbortError") setErr(String(e)); })
        .finally(() => setLoading(false));
    }, 250);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [league, hydrated]);

  useEffect(() => { if (hydrated) save("cv.league", league); }, [league, hydrated]);
  useEffect(() => { if (hydrated) save("cv.draft", draft); }, [draft, hydrated]);
  useEffect(() => { if (hydrated) save("cv.tab", tab); }, [tab, hydrated]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "kit", label: "Draft Kit" },
    { id: "mock", label: "Mock Draft" },
    { id: "draft", label: "Live Draft" },
    { id: "sheet", label: "Cheat Sheet" },
    { id: "news", label: "News & Takes" },
    { id: "edges", label: "ESPN vs Yahoo" },
    { id: "settings", label: "League Settings" },
  ];

  return (
    <ScoutingProvider>
    <PlayerSheetProvider league={league}>
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="flex items-center gap-2" title="CourtVision home">
            <LogoMark size={22} />
            <span className="text-base font-semibold tracking-tight">CourtVision</span>
          </Link>
          <nav className="no-scrollbar -mx-1 flex max-w-full gap-1 overflow-x-auto px-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`whitespace-nowrap rounded-full px-3 py-1 text-sm ${
                  tab === t.id ? "bg-sunken font-medium text-fg" : "text-muted hover:text-fg"
                }`}
              >
                {t.label}
              </button>
            ))}
            <Link
              href="/inseason"
              className="whitespace-nowrap rounded-full px-3 py-1 text-sm text-muted hover:text-fg"
            >
              In-Season
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-xs text-muted">
            <span>
              {league.format === "points" ? "Points" : "Cats"} · {league.teams} teams
              {board && ` · news ${board.takesUpdated}`}
              {loading && " · updating…"}
            </span>
            {board?.pro ? (
              <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 font-medium text-accent">PRO</span>
            ) : board && !board.paid && board.paymentLink ? (
              <a href={board.paymentLink} className="rounded-full bg-ink px-3 py-1 font-medium text-white hover:bg-ink/85">Unlock all</a>
            ) : null}
          </div>
        </div>
      </header>

      {tab === "kit" && !board?.pro && (
        <section className="border-b border-line print:hidden">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
            <h1 className="text-3xl font-medium leading-tight tracking-[-0.03em] sm:text-4xl">
              Rankings for your league,
              <br />
              <span className="text-muted">not ESPN&apos;s default.</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
              Set your exact scoring once. We re-rank every player for it, then adjust for injuries, trades, role changes
              and media-day news, updated daily with a source for every call. Then mock draft against the ESPN ADP.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button onClick={() => setTab("mock")} className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white hover:bg-ink/85">
                Start a mock draft →
              </button>
              <button onClick={() => setTab("settings")} className="rounded-full border border-line bg-panel px-5 py-2 text-sm font-medium hover:border-fg/30 hover:bg-sunken">
                Set up my league
              </button>
            </div>
            </div>
            {board && (
              <dl className="grid grid-cols-3 divide-x divide-line rounded-xl border border-line bg-panel text-center shadow-[0_1px_2px_rgba(25,25,25,0.04)]">
                {[
                  { k: "Players ranked", v: String(board.total) },
                  { k: "With a sourced take", v: String(board.valued.filter((x) => x.take).length) },
                  { k: "News updated", v: new Date(`${board.takesUpdated}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }) },
                ].map((x) => (
                  <div key={x.k} className="px-6 py-4">
                    <dd className="text-2xl font-medium tracking-tight tabular-nums">{x.v}</dd>
                    <dt className="mt-0.5 whitespace-nowrap text-[11px] uppercase tracking-wide text-muted">{x.k}</dt>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </section>
      )}

      <main className="mx-auto max-w-7xl px-4 py-5">
        {err && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-700">
            Couldn&apos;t load player data: {err}
          </div>
        )}
        {tab === "news" && <News />}
        {tab === "settings" && <LeagueSettings league={league} setLeague={setLeague} draft={draft} setDraft={setDraft} valued={board?.valued ?? null} />}

        {!board && !err && ["kit", "mock", "draft", "edges", "sheet"].includes(tab) && (
          <div className="py-20 text-center text-muted">Loading players…</div>
        )}
        {board && (
          <>
            {tab === "kit" && <Rankings board={board} league={league} draftedIds={new Set(draft.picks)} setLeague={setLeague} draft={draft} setDraft={setDraft} onEditSettings={() => setTab("settings")} />}
            {tab === "mock" && <MockDraft board={board} league={league} />}
            {tab === "edges" && <FormatEdges board={board} league={league} />}
            {tab === "sheet" && <CheatSheet board={board} league={league} draft={draft} />}
            {tab === "draft" && <DraftBoard board={board} league={league} draft={draft} setDraft={setDraft} />}
          </>
        )}
      </main>
      <footer className="mx-auto max-w-7xl px-4 pb-8 text-xs text-muted print:hidden">
        Projections blend ESPN&apos;s preseason projection with last season&apos;s production, adjusted by sourced analyst
        takes and a durability-adjusted games estimate. Not affiliated with ESPN or Yahoo.
      </footer>
    </div>
    </PlayerSheetProvider>
    </ScoutingProvider>
  );
}
