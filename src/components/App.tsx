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
  /** When the ESPN rankings, ADP and projections were last fetched. */
  espnAt?: string;
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

  // Four tabs. Cheat sheet and ESPN vs Yahoo are views of the rankings; settings sit behind the gear.
  const RANKING_VIEWS: { id: Tab; label: string }[] = [
    { id: "kit", label: "Board" },
    { id: "sheet", label: "Cheat sheet" },
    { id: "edges", label: "ESPN vs Yahoo" },
  ];
  const inRankings = RANKING_VIEWS.some((v) => v.id === tab);
  const tabs: { id: Tab; label: string; active: boolean }[] = [
    { id: "kit", label: "Rankings", active: inRankings },
    { id: "mock", label: "Mock Draft", active: tab === "mock" },
    { id: "draft", label: "Live Draft", active: tab === "draft" },
    { id: "news", label: "News", active: tab === "news" },
  ];

  return (
    <ScoutingProvider>
    <PlayerSheetProvider league={league}>
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="flex items-center gap-2" title="Takeover Fantasy home">
            <LogoMark size={22} />
            <span className="text-base font-semibold tracking-tight">Takeover Fantasy</span>
          </Link>
          <nav className="no-scrollbar -mx-1 flex max-w-full gap-1 overflow-x-auto px-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`whitespace-nowrap rounded-full px-3 py-1 text-sm ${
                  t.active ? "bg-sunken font-medium text-fg" : "text-muted hover:text-fg"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-xs text-muted">
            <span>
              {league.format === "points" ? "Points" : "Cats"} · {league.teams} teams
              {board && ` · news ${board.takesUpdated}`}
              {board?.espnAt && ` · ESPN data ${new Date(board.espnAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
              {loading && " · updating…"}
            </span>
            <Link href="/inseason" className="hover:text-fg">In-season</Link>
            {board?.authOn && (board.account ? (
              <form action="/auth/signout" method="post" className="flex items-center gap-2">
                <span className="hidden max-w-[12rem] truncate sm:inline" title={board.account}>{board.account}</span>
                <button className="hover:text-fg">Sign out</button>
              </form>
            ) : (
              <Link href="/login" className="rounded-full border border-line px-3 py-1 font-medium text-fg hover:border-fg/30 hover:bg-sunken">Sign in</Link>
            ))}
            <button
              onClick={() => setTab("settings")}
              title="League settings"
              aria-label="League settings"
              className={`rounded-full p-1.5 hover:bg-sunken hover:text-fg ${tab === "settings" ? "bg-sunken text-fg" : ""}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
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
        {inRankings && (
          <div className="mb-4 inline-flex rounded-full border border-line bg-panel p-0.5 text-sm print:hidden">
            {RANKING_VIEWS.map((v) => (
              <button
                key={v.id}
                onClick={() => setTab(v.id)}
                className={`rounded-full px-3 py-1 ${tab === v.id ? "bg-sunken font-medium text-fg" : "text-muted hover:text-fg"}`}
              >
                {v.label}
              </button>
            ))}
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
