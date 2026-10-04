import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { PAYWALL_ON } from "@/lib/auth";

const PRICE = process.env.CV_PRICE_LABEL ?? "$19 season pass";

/** Public landing page. The app itself lives at /draft. */
export default function Landing() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <LogoMark size={22} />
            <span className="text-base font-semibold tracking-tight">CourtVision</span>
          </Link>
          <nav className="hidden gap-5 text-sm text-muted sm:flex">
            <a href="#scouting" className="hover:text-fg">Scouting</a>
            <a href="#features" className="hover:text-fg">Features</a>
            <a href="#pricing" className="hover:text-fg">Pricing</a>
            <a href="#faq" className="hover:text-fg">FAQ</a>
          </nav>
          <Link href="/draft" className="ml-auto rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-white hover:bg-ink/85">
            Open the draft kit
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="border-b border-line">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-sm font-medium text-accent">Fantasy basketball · 2026-27</p>
              <h1 className="mt-3 text-4xl font-medium leading-[1.05] tracking-[-0.035em] sm:text-6xl">
                The draft kit that
                <br />
                <span className="text-muted">knows your league.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
                Rankings tuned to your exact ESPN scoring, a live draft assistant that syncs with your draft room, and a
                scouting report on every manager in your league, built from the players they drafted before.
              </p>
              <div className="mt-7 flex flex-wrap gap-2">
                <Link href="/draft" className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-ink/85">
                  Open the draft kit, free →
                </Link>
                <a href="#scouting" className="rounded-full border border-line bg-panel px-5 py-2.5 text-sm font-medium hover:border-fg/30 hover:bg-sunken">
                  See how scouting works
                </a>
              </div>
              <p className="mt-4 text-xs text-muted">No account needed. Works on your phone in the draft room.</p>
            </div>
            <HeroVisual />
          </div>
        </section>

        {/* Scouting */}
        <section id="scouting" className="border-b border-line">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-2 lg:items-center">
            <div>
              <Eyebrow>League scouting</Eyebrow>
              <H2 a="Know who your friends will take" b="before they take them." />
              <p className="mt-4 text-sm leading-relaxed text-muted">
                Connect your ESPN league and we read its past drafts, matching every manager by their ESPN account even if
                they renamed their team. You see who reaches for which players, who goes big men early, and who just
                autodrafts. On draft day, your targets warn you when someone picking before you took that player last year.
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                <Check>Works with private leagues, and with leagues that were recreated this season</Check>
                <Check>Mock drafts where CPU teams draft like your actual league mates</Check>
                <Check>The draft order fixes itself from round 1 once your real draft starts</Check>
              </ul>
            </div>
            <ScoutVisual />
          </div>
        </section>

        {/* Live draft */}
        <section className="border-b border-line bg-panel">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-2 lg:items-center">
            <DraftVisual />
            <div>
              <Eyebrow>Live draft sync</Eyebrow>
              <H2 a="Your ESPN draft room," b="with an assistant next to it." />
              <p className="mt-4 text-sm leading-relaxed text-muted">
                Turn on Sync from ESPN and picks fill in every few seconds. No browser extension, no typing in picks. The
                assistant recommends your next pick for your roster, flags who&apos;ll still be there next round, and late in
                the draft it swings for upside, because a bust is a free cut and a hit wins your league.
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                <Check>Star your targets and see if they&apos;ll last to your pick</Check>
                <Check>A do-not-draft list that the assistant never recommends</Check>
                <Check>Set your own rank for any player; everything follows it</Check>
              </ul>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-b border-line">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <Eyebrow>Everything else</Eyebrow>
            <H2 a="Rankings with reasons," b="not just a list." />
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-xl border border-line bg-panel p-5 shadow-[0_1px_2px_rgba(25,25,25,0.04)]">
                  <div className="text-sm font-medium">{f.title}</div>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Comparison */}
        <section className="border-b border-line bg-panel">
          <div className="mx-auto max-w-4xl px-4 py-16">
            <Eyebrow>Why CourtVision</Eyebrow>
            <H2 a="Built for your league," b="not the average one." />
            <div className="mt-8 overflow-hidden rounded-xl border border-line">
              <table className="w-full text-sm">
                <thead className="bg-sunken text-left text-xs text-muted">
                  <tr><th className="px-4 py-2.5 font-medium" /><th className="px-4 py-2.5 font-medium">CourtVision</th><th className="px-4 py-2.5 font-medium">A typical draft kit</th></tr>
                </thead>
                <tbody>
                  {COMPARE.map(([row, us, them]) => (
                    <tr key={row} className="border-t border-line">
                      <td className="px-4 py-3">{row}</td>
                      <td className="px-4 py-3 font-medium text-accent">{us}</td>
                      <td className="px-4 py-3 text-muted">{them}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-b border-line">
          <div className="mx-auto max-w-4xl px-4 py-16">
            <Eyebrow>Pricing</Eyebrow>
            <H2 a="One price for the season." b={PAYWALL_ON ? "Start free." : "Free while we're in beta."} />
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <Plan name="Free" price="$0" items={["Top 50 players for your scoring", "Short mock drafts", "Daily sourced news and takes", "ESPN vs Yahoo comparison"]} />
              <Plan
                name="Season pass"
                price={PRICE.replace(/\s*season pass/i, "")}
                note={PAYWALL_ON ? "One payment, through the 2026-27 season" : "Everything is unlocked during the beta"}
                strong
                items={["Every player, every tier, every note", "Full-length mocks vs your league mates", "Live ESPN draft sync and assistant", "League scouting from past drafts", "In-season waiver picks and alerts"]}
              />
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-b border-line">
          <div className="mx-auto max-w-3xl px-4 py-16">
            <Eyebrow>FAQ</Eyebrow>
            <div className="mt-6 divide-y divide-line rounded-xl border border-line bg-panel">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium">
                    {q}<span className="text-muted transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section>
          <div className="mx-auto max-w-6xl px-4 py-20 text-center">
            <h2 className="text-3xl font-medium tracking-[-0.03em] sm:text-4xl">Draft day is coming.</h2>
            <p className="mt-3 text-sm text-muted">Set your league up in two minutes and run a mock against your friends tonight.</p>
            <Link href="/draft" className="mt-6 inline-block rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-white hover:bg-ink/85">
              Open the draft kit →
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-6 text-xs text-muted">
          <LogoMark size={16} /> CourtVision
          <span className="ml-auto">Not affiliated with ESPN, Yahoo or the NBA.</span>
        </div>
      </footer>
    </div>
  );
}

const FEATURES = [
  { title: "Your exact scoring", body: "Import your ESPN league's real scoring and roster slots. Every player is re-ranked for it, points or categories, with punts." },
  { title: "Sourced daily takes", body: "Injuries, trades and camp reports turn into projection changes, each with a link to the source. Updated every day of the preseason." },
  { title: "Notes on every player", body: "His role on his team, how his line changes from last season, his range of outcomes, and when to draft him against ADP." },
  { title: "Late-round swings", body: "Players going late whose good-case season is a top-40 finish. Deep sleepers stay on the radar instead of vanishing." },
  { title: "Mock drafts that feel real", body: "Practice against CPU teams that draft like ESPN users, sharp drafters, or your actual league mates. Graded against the room." },
  { title: "ESPN vs Yahoo", body: "Play in more than one league? See who your scoring quietly favors, with the per-game math behind every move." },
];

const COMPARE: [string, string, string][] = [
  ["Rankings for your league's exact scoring", "Imported from ESPN", "Pick a preset"],
  ["Live ESPN draft sync", "Built in, no extension", "Extension or not offered"],
  ["Scouting report on your league mates", "From their past drafts", "Not offered"],
  ["Why each player ranks where he does", "Notes and sources on every player", "A number"],
  ["Late-round strategy", "Upside picks and deep sleepers", "Same list all draft"],
];

const FAQ: [string, string][] = [
  ["Does it work with Yahoo, Sleeper or Fantrax?", "Rankings and mocks work for any league: pick a Yahoo or ESPN preset or enter your scoring. League import, live draft sync and scouting are ESPN-only for now."],
  ["My ESPN league is private. Is that a problem?", "No. Add your ESPN cookies once in League Settings. They're kept in your browser and passed to ESPN only when you read your league; we never store them."],
  ["Where do the rankings come from?", "ESPN's projections and last season's production, adjusted for age, games played, team fit and our sourced daily takes, then valued for your scoring and league size."],
  ["Can I disagree with your rankings?", "Yes. Set your own rank for any player, star targets, or put players on a do-not-draft list. The draft assistant follows your board."],
  ["Does it help after the draft?", "Yes. The in-season tools suggest waiver pickups, plan streaming around the schedule, and can send injury and lineup alerts."],
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">{children}</p>;
}

function H2({ a, b }: { a: string; b: string }) {
  return (
    <h2 className="mt-2 text-3xl font-medium leading-tight tracking-[-0.03em] sm:text-4xl">
      {a}
      <br />
      <span className="text-muted">{b}</span>
    </h2>
  );
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10px] text-accent">✓</span>
      <span>{children}</span>
    </li>
  );
}

function Plan({ name, price, items, note, strong }: { name: string; price: string; items: string[]; note?: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl border p-6 ${strong ? "border-ink bg-panel shadow-[0_8px_30px_rgba(25,25,25,0.08)]" : "border-line bg-panel"}`}>
      <div className="text-sm font-medium">{name}</div>
      <div className="mt-2 text-4xl font-medium tracking-tight">{price}</div>
      {note && <div className="mt-1 text-xs text-muted">{note}</div>}
      <ul className="mt-5 space-y-2 text-sm">{items.map((i) => <Check key={i}>{i}</Check>)}</ul>
      <Link href="/draft" className={`mt-6 block rounded-full py-2 text-center text-sm font-medium ${strong ? "bg-ink text-white hover:bg-ink/85" : "border border-line hover:bg-sunken"}`}>
        {strong ? "Get the season pass" : "Start free"}
      </Link>
    </div>
  );
}

/* ---------- Product visuals (illustrative data) ---------- */

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-panel shadow-[0_20px_60px_rgba(25,25,25,0.10)]">
      <div className="flex items-center gap-1.5 border-b border-line px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-line" /><span className="h-2.5 w-2.5 rounded-full bg-line" /><span className="h-2.5 w-2.5 rounded-full bg-line" />
        <span className="ml-2 text-xs text-muted">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Face({ id, size = 32 }: { id: number; size?: number }) {
  return (
    <span className="inline-block shrink-0 overflow-hidden rounded-full border border-line bg-sunken" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/${id}.png&w=${size * 3}&h=${Math.round(size * 2.2)}`} alt="" className="h-full w-full object-cover object-top" />
    </span>
  );
}

function HeroVisual() {
  const rows = [
    { id: 5041939, name: "Cooper Flagg", note: "Go-to scorer in Dallas · 35 min", rank: 16, espn: 24 },
    { id: 4684740, name: "Amen Thompson", note: "Confirmed starter and All-Star candidate", rank: 14, espn: 17 },
    { id: 5095151, name: "Caleb Wilson", note: "Boom or bust: top-21 if it hits", rank: 79, espn: 66 },
  ];
  return (
    <Frame title="Draft Kit · your league · 10 teams, points">
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-3 py-2.5">
            <Face id={r.id} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{r.name}</div>
              <div className="truncate text-[11px] text-muted">{r.note}</div>
            </div>
            <div className="text-right text-xs tabular-nums">
              <div className="font-medium">#{r.rank}</div>
              <div className="text-muted">ESPN #{r.espn}</div>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-700">
        ★ Amen Thompson: Jordan picks before you and took him in round 2 last year.
      </div>
    </Frame>
  );
}

function ScoutVisual() {
  const managers = [
    { name: "Jordan", slot: 4, lean: "Goes PG early", picks: ["Luka Doncic R1", "Amen Thompson R2", "Alperen Sengun R3"] },
    { name: "Priya", slot: 6, lean: "Goes C early", picks: ["Victor Wembanyama R1", "Jaylen Brown R2", "Tyrese Maxey R3"] },
    { name: "Marcus", slot: 9, lean: "Autodrafted 60% of picks", picks: [] },
  ];
  return (
    <Frame title="League scouting · last season's draft">
      <div className="grid gap-3">
        {managers.map((m) => (
          <div key={m.name} className="rounded-lg border border-line bg-bg p-3">
            <div className="flex items-baseline justify-between text-sm"><span className="font-medium">{m.name}</span><span className="text-xs text-muted">Picks #{m.slot}</span></div>
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
              <span className={`rounded px-1.5 py-0.5 ${m.picks.length ? "bg-sunken" : "bg-amber-500/10 text-amber-800"}`}>{m.lean}</span>
              {m.picks.map((p) => <span key={p} className="rounded-full border border-line bg-panel px-2 py-0.5">{p}</span>)}
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function DraftVisual() {
  return (
    <Frame title="Live Draft · synced with ESPN · pick 4.6">
      <div className="text-xs text-muted">Your pick, recommended</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {[
          { id: 4433134, name: "Scottie Barnes", tags: ["Fills your empty SF spot"] },
          { id: 4433621, name: "Jalen Duren", tags: ["Won't last: usually goes around pick 33"] },
        ].map((r, i) => (
          <div key={r.name} className={`rounded-lg border p-3 ${i === 0 ? "border-fg/30 bg-sunken" : "border-line"}`}>
            <div className="flex items-center gap-2"><Face id={r.id} size={28} /><span className="text-sm font-medium">{r.name}</span></div>
            <div className="mt-2 flex flex-wrap gap-1">{r.tags.map((t) => <span key={t} className="rounded bg-fg/5 px-1.5 py-0.5 text-[10px] text-muted">{t}</span>)}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between rounded-lg border border-line px-3 py-2 text-xs">
        <span className="text-muted">Sync from ESPN</span>
        <span className="font-medium text-emerald-700">● 46 picks synced · draft in progress</span>
      </div>
    </Frame>
  );
}
