import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { leagueContext, previewContext } from "@/lib/inseason/profile";
import { movePlayers } from "@/lib/moveRater";
import { rateTrade, type TradeVerdict } from "@/lib/trades";
import { TradePicker } from "./TradePicker";

export const dynamic = "force-dynamic";

type Search = Promise<Record<string, string | string[] | undefined>>;
const ids = async (s: Search) => {
  const q = await s;
  const list = (v: unknown) => (typeof v === "string" ? v.split(",").filter((x) => /^\d{1,9}$/.test(x)).map(Number).slice(0, 4) : []);
  return { give: list(q.give), get: list(q.get), all: q.all === "1" };
};

type P = { id: number; name: string; team: string; owner?: string };

/** The viewer's connected league, if any: their roster to give from, everyone else's to get from. */
async function leaguePools(): Promise<{ mine: P[]; theirs: P[]; teamName?: string } | null> {
  const r = await leagueContext().catch(() => null);
  const ctx = r?.ok ? r.ctx : await previewContext().catch(() => null);
  if (!ctx) return null;
  const snap = await ctx.storage.getLatestSnapshot(ctx.leagueId, ctx.seasonId).catch(() => null);
  if (!snap) return null;
  const row = (e: { player: { id: number; name: string; nbaTeamAbbrev?: string } }, owner?: string): P => ({ id: e.player.id, name: e.player.name, team: e.player.nbaTeamAbbrev ?? "", ...(owner ? { owner } : {}) });
  const me = snap.teams.find((t) => t.id === snap.myTeamId);
  const mine = (me?.roster ?? []).map((e) => row(e));
  const theirs = snap.teams.filter((t) => t.id !== snap.myTeamId).flatMap((t) => (t.roster ?? []).map((e) => row(e, t.name)));
  return mine.length ? { mine, theirs, teamName: me?.name } : null;
}

const names = (ps: { name: string }[]) => ps.map((p) => p.name).join(" + ");

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const { give, get } = await ids(searchParams);
  const r = give.length && get.length ? await rateTrade(give, get).catch(() => null) : null;
  const title = r ? `${names(r.give)} for ${names(r.get)}? · Takeover Fantasy` : "Fantasy basketball trade analyzer · Takeover Fantasy";
  const description = r ? r.headline : "Check any fantasy basketball trade: rest-of-season points per game, injuries and slumps counted. Free, no account.";
  return { title, description, openGraph: { title, description }, twitter: { card: "summary", title, description } };
}

const TONE: Record<TradeVerdict, string> = { accept: "text-[#2f7d5d]", close: "text-fg", decline: "text-[#b42318]" };

/** Public trade checker: a verdict on any trade, by rest-of-season value with health counted. */
export default async function Trade({ searchParams }: { searchParams: Search }) {
  const { give, get, all } = await ids(searchParams);
  const [players, league, r] = await Promise.all([
    movePlayers().catch(() => [] as P[]),
    all ? null : leaguePools(),
    give.length && get.length ? rateTrade(give, get).catch(() => null) : null,
  ]);
  const givePool = league?.mine ?? players, getPool = league?.theirs ?? players;
  const pick = (list: number[], pool: P[]) => list.map((id) => pool.find((p) => p.id === id) ?? players.find((p) => p.id === id)).filter((p): p is P => !!p);
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/" className="flex items-center gap-2 text-sm font-semibold"><LogoMark size={20} /> Takeover Fantasy</Link>
      <h1 className="mt-8 text-3xl font-medium tracking-[-0.03em]">Check a trade</h1>
      <p className="mt-2 text-sm text-muted">Pick what you give and what you get. Judged on rest-of-season points per game, with injuries, games missed and slumps counted. Free, no account.</p>
      {league ? (
        <p className="mt-2 text-xs text-muted">
          From your league: you give from {league.teamName ?? "your team"}, you get from the other rosters.{" "}
          <Link href={`/trade?all=1${give.length ? `&give=${give.join(",")}` : ""}${get.length ? `&get=${get.join(",")}` : ""}`} className="underline hover:text-fg">Use any player</Link>
        </p>
      ) : null}
      <TradePicker givePool={givePool} getPool={getPool} give={pick(give, givePool)} get={pick(get, getPool)} all={all} />

      {r && (
        <section className="mt-10">
          <h2 className={`text-2xl font-medium tracking-[-0.02em] ${TONE[r.verdict]}`}>{r.headline}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {([["You give", r.give], ["You get", r.get]] as const).map(([t, ps]) => (
              <div key={t} className="rounded-xl border border-line bg-panel p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{t}</div>
                <ul className="mt-2 space-y-2 text-sm">
                  {ps.map((p) => (
                    <li key={p.id} className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate">{p.name} <span className="text-xs text-muted">{p.team}</span></span>
                      <span className="shrink-0 text-right text-xs tabular-nums text-muted">
                        <span className="font-medium text-fg">{p.ros}</span> a game{p.recent !== null ? ` · ${p.recent} lately` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <ul className="mt-4 space-y-1.5 text-sm">
            {r.reasons.map((x) => <li key={x} className="flex gap-2"><span className="text-muted">·</span>{x}</li>)}
          </ul>
          <p className="mt-3 text-xs text-muted">A game: expected fantasy points per team game the rest of the season, counting the games he&apos;ll miss. Lately: his last few games.</p>
          <div className="mt-8 rounded-xl border border-line bg-panel p-5">
            <div className="text-sm font-medium">Find the trades worth making in your league</div>
            <p className="mt-1 text-sm text-muted">We scan every roster in your league for stars in a slump to buy low, and your players to sell high, with offers the other manager should take.</p>
            <Link href="/inseason/trades" className="mt-4 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-ink/85">Find my league&apos;s trades →</Link>
          </div>
        </section>
      )}
      {(give.length > 0 || get.length > 0) && !r && <p className="mt-8 text-sm text-muted">Couldn&apos;t check that one. Pick at least one player on each side, no player on both.</p>}
    </main>
  );
}
