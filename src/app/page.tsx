import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { PAYWALL_ON } from "@/lib/auth";
import { seasonMode } from "@/lib/season";


// Re-render hourly so season mode switches on by itself.
export const revalidate = 3600;

/** During the season, search results and link previews lead with the promise: win without refreshing the news all day. */
export function generateMetadata(): Metadata {
  return seasonMode()
    ? {
        title: "Takeover Fantasy · Win your fantasy basketball league without living on Twitter",
        description: "Breaking injury alerts with the pickup on Telegram within minutes, and every morning the add/drops that win your week, for your fantasy team. Connect your ESPN league and see your best move free.",
      }
    : {};
}

/** Public landing page. The draft kit lives at /draft, the in-season tools at /inseason. */
export default function Landing() {
  const season = seasonMode();
  return (
    <div className="min-h-screen">
      {/* Layer-style guide lines framing the content column. */}
      <div aria-hidden className="pointer-events-none fixed inset-y-0 left-1/2 z-0 hidden w-full max-w-6xl -translate-x-1/2 border-x border-line lg:block" />
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <LogoMark size={22} />
            <span className="text-base font-semibold tracking-tight">Takeover Fantasy</span>
          </Link>
          <nav className="hidden gap-5 text-sm text-muted sm:flex">
            <a href={season ? "#plays-out" : "#scouting"} className="hover:text-fg">{season ? "How it works" : "Scouting"}</a>
            <a href="#features" className="hover:text-fg">Features</a>
            <a href="#pricing" className="hover:text-fg">Pricing</a>
            <a href="#faq" className="hover:text-fg">FAQ</a>
            {season ? <Link href="/draft" className="hover:text-fg">Draft kit</Link> : <Link href="/inseason" className="hover:text-fg">In-season</Link>}
          </nav>
          <Link href={season ? "/inseason/connect" : "/draft"} className="ml-auto whitespace-nowrap rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-white hover:bg-ink/85">
            {season ? "See your best move" : "Open the draft kit"}
          </Link>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        {season ? <SeasonHero /> : (
        <section className="border-b border-line">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="animate-fade-up text-sm font-medium text-accent">Fantasy basketball · 2026-27</p>
              <h1 style={{ animationDelay: "60ms" }} className="animate-fade-up mt-3 text-4xl font-medium leading-[1.05] tracking-[-0.035em] sm:text-6xl">
                The draft kit that
                <br />
                <span className="text-muted">knows your league.</span>
              </h1>
              <p style={{ animationDelay: "120ms" }} className="animate-fade-up mt-5 max-w-xl text-base leading-relaxed text-muted">
                Rankings tuned to your exact ESPN scoring, a live draft assistant that syncs with your draft room, a
                scouting report on every manager in your league, and in-season help with waivers and lineups after the draft.
              </p>
              <div style={{ animationDelay: "220ms" }} className="animate-fade-up mt-7 flex flex-wrap gap-2">
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
        )}

        {season ? <SeasonSections /> : (<>
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
            <Eyebrow>Why Takeover</Eyebrow>
            <H2 a="Built for your league," b="not the average one." />
            <div className="mt-8 overflow-hidden rounded-xl border border-line">
              <table className="w-full text-sm">
                <thead className="bg-sunken text-left text-xs text-muted">
                  <tr><th className="px-4 py-2.5 font-medium" /><th className="px-4 py-2.5 font-medium">Takeover Fantasy</th><th className="px-4 py-2.5 font-medium">A typical draft kit</th></tr>
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

        </>)}

        {/* Pricing */}
        <section id="pricing" className="border-b border-line">
          <div className="mx-auto max-w-4xl px-4 py-16">
            <Eyebrow>Pricing</Eyebrow>
            <H2 a="Try a week. Keep it for the season." b={season ? "Injury alerts are free, forever." : PAYWALL_ON ? "The draft kit is free." : "Free while we're in beta."} />
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {season
                ? <Plan name="Free" price="$0" note="Forever, no card" href="/inseason/connect" cta="See your best move" items={["Breaking injury alerts with the pickup", "Free in your league, or taken", "Last night's waiver heroes", "Your week's gain and your best move"]} />
                : <Plan name="Draft kit" price="Free" href="/draft" cta="Open the draft kit" items={["Every player ranked for your scoring", "Full mock drafts", "Live ESPN draft assistant", "Daily news and takes"]} />}
              <Plan
                name={WEEKLY ? "Weekly" : "Week pass"}
                price={WEEKLY ? "$5/wk" : "$5"}
                note={!PAYWALL_ON ? "Everything is unlocked during the beta" : WEEKLY ? "Less than one wasted pickup costs you. Cancel anytime." : "7 days, one payment, no auto-renew"}
                href="/inseason"
                cta="Try a week"
                items={["Every add/drop for your roster, each morning", "The day to make each move", "Lineup check before lock", "Alerts on Telegram or email"]}
              />
              <Plan
                name="Season pass"
                price="$39"
                note={PAYWALL_ON ? "About $1.50 a week, through the 2026-27 playoffs" : "Everything is unlocked during the beta"}
                strong
                href="/inseason"
                cta="Get the season"
                items={["Everything in weekly", "Every week through the playoffs", "Next-week schedule warnings", "One payment, no auto-renew"]}
              />
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-b border-line">
          <div className="mx-auto max-w-3xl px-4 py-16">
            <Eyebrow>FAQ</Eyebrow>
            <div className="mt-6 divide-y divide-line rounded-xl border border-line bg-panel">
              {(season ? SEASON_FAQ : FAQ).map(([q, a]) => (
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
            <h2 className="text-3xl font-medium tracking-[-0.03em] sm:text-4xl">{season ? "The season is on." : "Draft day is coming."}</h2>
            <p className="mt-3 text-sm text-muted">
              {season ? "Paste your ESPN league link and see your best move this week. No account needed." : "Set your league up in two minutes and run a mock against your friends tonight."}
            </p>
            <Link href={season ? "/inseason/connect" : "/draft"} className="mt-6 inline-block rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-white hover:bg-ink/85">
              {season ? "See your best move, free →" : "Open the draft kit →"}
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-6 text-xs text-muted">
          <LogoMark size={16} /> Takeover Fantasy
          <Link href="/privacy" className="ml-auto hover:text-fg">Privacy</Link>
          <Link href="/terms" className="hover:text-fg">Terms</Link>
          <span>Not affiliated with ESPN, Yahoo or the NBA.</span>
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

function Plan({ name, price, items, note, strong, href, cta }: { name: string; price: string; items: string[]; note?: string; strong?: boolean; href: string; cta: string }) {
  return (
    <div className={`rounded-xl border p-6 ${strong ? "border-ink bg-panel shadow-[0_8px_30px_rgba(25,25,25,0.08)]" : "border-line bg-panel"}`}>
      <div className="text-sm font-medium">{name}</div>
      <div className="mt-2 text-4xl font-medium tracking-tight">{price}</div>
      {note && <div className="mt-1 text-xs text-muted">{note}</div>}
      <ul className="mt-5 space-y-2 text-sm">{items.map((i) => <Check key={i}>{i}</Check>)}</ul>
      <Link href={href} className={`mt-6 block rounded-full py-2 text-center text-sm font-medium ${strong ? "bg-ink text-white hover:bg-ink/85" : "border border-line hover:bg-sunken"}`}>
        {cta}
      </Link>
    </div>
  );
}

/** The weekly plan is a subscription once its Stripe link is set. */
const WEEKLY = !!process.env.STRIPE_WEEKLY_LINK;

/** Everything below the hero during the season: how an alert plays out, then what you get. */
function SeasonSections() {
  return (
    <>
      <PlaysOut />

      {/* 1. Breaking alerts */}
      <section id="features" className="border-b border-line">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-2 lg:items-center">
          <div>
            <Eyebrow>Breaking alerts · free</Eyebrow>
            <H2 a="First to every pickup." b="Before your league mates refresh ESPN." />
            <p className="mt-4 text-sm leading-relaxed text-muted">
              We check the injury report every 10 minutes. When a starter is ruled out for more than a game or two, you get
              the teammate who takes his minutes, about what he&apos;ll score, and whether he&apos;s still free in your league,
              with a link straight to the add on ESPN.
            </p>
            <ul className="mt-5 space-y-2 text-sm">
              <Check>The pickup, from who actually plays his minutes</Check>
              <Check>Free in your league, or already taken: checked for you</Check>
              <Check>On Telegram within minutes. Free, forever</Check>
            </ul>
          </div>
          <AlertVisual />
        </div>
      </section>

      {/* 2. Daily moves */}
      <section className="border-b border-line bg-panel">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-2 lg:items-center">
          <MovesVisual />
          <div>
            <Eyebrow>Daily moves</Eyebrow>
            <H2 a="Your moves every morning," b="for your roster, not everyone's." />
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Around 7am New York time: the add/drops that add the most points to your week, who to drop from your streaming
              spots, and the day to make each one. Only when a move is worth making.
            </p>
            <ul className="mt-5 space-y-2 text-sm">
              <Check>Ranked by points that make your lineup</Check>
              <Check>The day to swap, so no game is wasted</Check>
              <Check>Your keepers never show up as drops</Check>
            </ul>
          </div>
        </div>
      </section>

      {/* 3. Lineup check */}
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-2 lg:items-center">
          <div>
            <Eyebrow>Lineup check</Eyebrow>
            <H2 a="Never start" b="an injured player again." />
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Before the day&apos;s first tip-off we compare your lineup with tonight&apos;s games. A starter who&apos;s been ruled
              out, or a bench player who should start, gets flagged while there&apos;s still time to fix it.
            </p>
          </div>
          <LineupVisual />
        </div>
      </section>

      {/* Proof */}
      <section className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-14 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Eyebrow>Receipts</Eyebrow>
            <h2 className="mt-2 text-2xl font-medium leading-tight tracking-[-0.03em] sm:text-3xl">We post our picks. Then we score them.</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
              Every Monday we save our top 10 streamers next to ESPN&apos;s 10 most-added players, then count the fantasy points
              each group scores. Good weeks and bad ones.
            </p>
          </div>
          <Link href="/scorecard" className="shrink-0 self-start rounded-full border border-line bg-panel px-5 py-2.5 text-sm font-medium hover:border-fg/30 hover:bg-sunken sm:self-auto">
            See the receipts →
          </Link>
        </div>
      </section>

      {/* How we pick */}
      <section id="how" className="border-b border-line">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <Eyebrow>How we pick</Eyebrow>
            <h2 className="mt-2 text-2xl font-medium leading-tight tracking-[-0.03em] sm:text-3xl">A pickup only counts on days he starts.</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              We fill your lineup day by day, the way ESPN would, and rank pickups by the games that actually score for you.
            </p>
            <div className="mt-6"><WeekVisual /></div>
          </div>
          <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:pt-10">
            {SEASON_FEATURES.map((f) => (
              <div key={f.title}>
                <dt className="text-sm font-medium">{f.title}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-muted">{f.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}

/** One alert, start to finish: an illustrative weekday afternoon in Eastern time. */
function PlaysOut() {
  const steps = [
    { t: "2:14 PM", title: "A starting guard is ruled out for 2 weeks.", body: "The injury report updates mid-afternoon. Your league mates are at work." },
    { t: "2:21 PM", title: "🚨 Telegram: pick up Ajay Mitchell.", body: "About 30 fantasy points a game while he's out. ✅ Free in your league.", hot: true },
    { t: "2:22 PM", title: "You add him in one tap.", body: "The alert opens the add on ESPN." },
    { t: "7:00 PM", title: "Your league mates see it at tip-off.", body: "He's already on your roster." },
  ];
  return (
    <section id="plays-out" className="border-b border-line bg-panel">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <Eyebrow>How it plays out</Eyebrow>
        <H2 a="A starter goes down at 2:14." b="He's replaced on your roster by 2:22." />
        <ol className="mt-10 grid border-l border-line lg:grid-cols-4 lg:border-l-0 lg:border-t">
          {steps.map((s) => (
            <li key={s.t} className="relative pb-7 pl-6 last:pb-0 lg:pb-0 lg:pl-0 lg:pr-6 lg:pt-6">
              <span className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full lg:-top-[5px] lg:left-0 ${s.hot ? "bg-ink" : "border border-line bg-bg"}`} />
              <div className="text-xs font-medium tabular-nums text-muted">{s.t} <span className="font-normal">ET</span></div>
              <div className={`mt-1 text-sm ${s.hot ? "font-medium" : ""}`}>{s.title}</div>
              <p className="mt-1 text-sm leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-xs text-muted">An illustrative weekday afternoon. Breaking alerts check the injury report every 10 minutes.</p>
      </div>
    </section>
  );
}

/** A lock screen with the alert on it. */
function PhoneVisual() {
  return (
    <div style={{ animationDelay: "260ms" }} className="animate-fade-up mx-auto w-full max-w-[320px] rounded-[2.5rem] border border-line bg-panel p-3 shadow-[0_20px_60px_rgba(25,25,25,0.10)]">
      <div className="rounded-[2rem] bg-sunken px-3 pb-8 pt-10">
        <div className="text-center">
          <div className="text-xs text-muted">Tuesday</div>
          <div className="text-5xl font-medium tabular-nums tracking-[-0.04em]">2:21</div>
        </div>
        <div className="mt-8 rounded-2xl border border-line bg-panel p-3 shadow-[0_1px_2px_rgba(25,25,25,0.04)]">
          <div className="flex items-center gap-2 text-[11px] text-muted">
            <LogoMark size={20} />
            <span className="font-medium text-fg">Takeover Fantasy</span>
            <span className="ml-auto">now</span>
          </div>
          <p className="mt-2 text-[13px] font-medium leading-snug">🚨 A starting guard is out for 2 weeks</p>
          <div className="mt-2 flex items-center gap-2.5">
            <Face id={4900671} size={28} />
            <p className="text-xs leading-snug">
              <span className="font-medium">Pickup: Ajay Mitchell</span>
              <span className="text-muted">, ~30 pts a game while he&apos;s out · 11% rostered</span>
            </p>
          </div>
          <p className="mt-2 text-xs">✅ Free in your league right now</p>
          <div className="mt-2.5 rounded-full bg-ink py-1.5 text-center text-xs font-medium text-white">Add him on ESPN</div>
        </div>
      </div>
    </div>
  );
}

/** One week of your lineup: open spots per day, and the days a pickup plays. */
function WeekVisual() {
  const days = [
    { d: "Mon", playing: 7, pickup: false }, { d: "Tue", playing: 10, pickup: false }, { d: "Wed", playing: 11, pickup: true },
    { d: "Thu", playing: 4, pickup: true }, { d: "Fri", playing: 10, pickup: false }, { d: "Sat", playing: 5, pickup: true }, { d: "Sun", playing: 6, pickup: true },
  ];
  const slots = 10;
  return (
    <Frame title="Your lineup this week · 10 starting spots">
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {days.map((x) => {
          const open = Math.max(0, slots - x.playing);
          const counts = x.pickup && open > 0;
          return (
            <div key={x.d}>
              <div className="text-[11px] text-muted">{x.d}</div>
              <div className="mt-1 flex h-24 flex-col-reverse overflow-hidden rounded-md bg-sunken">
                <div className="bg-ink/80" style={{ height: `${(Math.min(x.playing, slots) / slots) * 100}%` }} />
              </div>
              <div className="mt-1 text-[11px] tabular-nums">{Math.min(x.playing, slots)}/{slots}</div>
              <div className={`mt-1 rounded px-0.5 py-0.5 text-[10px] font-semibold uppercase ${x.pickup ? (counts ? "bg-accent/15 text-accent" : "bg-sunken text-muted line-through") : "text-transparent"}`}>
                {x.pickup ? (counts ? "+1" : "bench") : "·"}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted">
        The pickup plays 4 games, but only <span className="font-medium text-fg">3 count</span>: Wednesday your lineup is already full.
      </p>
    </Frame>
  );
}

function AlertVisual() {
  return (
    <Frame title="Telegram · Takeover Fantasy">
      <div className="rounded-xl border border-line bg-bg p-3">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-[#b42318] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-white" />Breaking
        </div>
        <div className="mt-2 flex items-center gap-2.5">
          <Face id={4278067} />
          <div className="text-sm"><span className="font-medium">Nic Claxton</span> <span className="text-muted">out, back in about 2 weeks</span></div>
        </div>
        <div className="mt-2.5 rounded-lg border border-line bg-panel p-2">
          <div className="flex items-center gap-2.5">
            <Face id={4397189} size={28} />
            <div className="text-xs"><div className="text-[10px] font-semibold uppercase tracking-wide text-accent">Pickup</div><span className="font-medium">Jalen Smith</span> <span className="text-muted">· ~24 pts a game while he&apos;s out · +9 min · 6% rostered</span></div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2 text-xs">
            <span>✅ Free in your league right now</span>
            <span className="shrink-0 font-medium underline underline-offset-2">Add him on ESPN</span>
          </div>
        </div>
      </div>
    </Frame>
  );
}

function LineupVisual() {
  return (
    <Frame title="Lineup alert · 6:10 PM ET · before first tip">
      <ul className="space-y-2 text-sm">
        <li className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-red-700">Your starting PF is <span className="font-medium">out</span> tonight but in your starting lineup.</li>
        <li className="rounded-lg border border-line bg-bg px-3 py-2">Start your bench forward: he plays at 7:30 <span className="text-muted">(about +24 projected pts)</span>.</li>
        <li className="rounded-lg border border-line bg-bg px-3 py-2 text-muted">To make room, bench your PF.</li>
      </ul>
    </Frame>
  );
}

const SEASON_FEATURES = [
  { title: "The day to swap", body: "Keep a player through his last game, then add the replacement: moves marked \"After Tue\" waste no games." },
  { title: "Next week, checked", body: "Before any drop we look at next week too, and warn you if he has a big one coming." },
  { title: "Waivers and limits", body: "Waiver players clear in about two days, and weekly pickup caps get the best moves first." },
  { title: "Points or categories", body: "Points leagues rank by points added; categories leagues by games that make your lineup." },
];

const SEASON_FAQ: [string, string][] = [
  ["Do you make moves for me?", "No. We suggest the moves and you make them on ESPN. ESPN doesn't allow automated play, and you stay in control of your team."],
  ["My ESPN league is private. Is that a problem?", "No. Add your ESPN cookies once when you connect. They're stored encrypted and used only to read your league."],
  ["Does it work with Yahoo, Sleeper or Fantrax?", "The daily moves are ESPN-only for now. The free news alerts work for any league."],
  ["Do I need an account?", "Not to look. Paste your ESPN league link and see your best move this week. Add your email to save your league and get the free injury alerts."],
  ["What does the free version include?", "Breaking injury alerts with the pickup (and whether he's free in your league), last night's waiver heroes, and for your league, how much this week's moves would add plus your best one."],
  ["Can I cancel?", "Weekly cancels in one click from My league. The season pass is a single payment that runs through the playoffs."],
];

/** The hero during the season: the outcome (winning without refreshing news all day), then the free first step. */
function SeasonHero() {
  return (
    <section className="border-b border-line">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-14 sm:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div>
          <p className="animate-fade-up text-sm font-medium text-accent">Fantasy basketball · 2026-27 season</p>
          <h1 style={{ animationDelay: "60ms" }} className="animate-fade-up mt-3 text-[2.6rem] font-medium leading-[1.04] tracking-[-0.035em] sm:text-6xl">
            Win your league
            <br />
            <span className="text-muted">without living on Twitter.</span>
          </h1>
          <p style={{ animationDelay: "120ms" }} className="animate-fade-up mt-5 max-w-xl text-base leading-relaxed text-muted">
            We watch every injury, box score and waiver wire around the clock. When a starter goes down, you get the pickup on
            Telegram within minutes. Every morning, the add/drops that win your week, for your league.
          </p>
          <div style={{ animationDelay: "200ms" }} className="animate-fade-up mt-7 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link href="/inseason/connect" className="rounded-full bg-ink px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-ink/85">
              See your best move, free →
            </Link>
            <Link href="/login?next=/inseason/connect" className="rounded-full border border-line bg-panel px-5 py-2.5 text-center text-sm font-medium hover:border-fg/30 hover:bg-sunken">
              Get free injury alerts
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted">No account needed to look. Connects public and private ESPN leagues, points or categories.</p>
        </div>
        <PhoneVisual />
      </div>
    </section>
  );
}

/* ---------- Product visuals (illustrative data) ---------- */

function MovesVisual() {
  // Illustrative, but realistic: the kind of player actually on your waiver wire (under 20% rostered).
  const moves = [
    { add: { id: 4432194, name: "Day'Ron Sharpe", meta: "BKN · C · 19% rostered" }, drop: "your 2-game big", gain: 42, note: "+2 usable games. Plays Thu and Sat, when your lineup has open spots.", when: "" },
    { add: { id: 4900671, name: "Ajay Mitchell", meta: "OKC · G · 11% rostered" }, drop: "your bench guard", gain: 27, note: "Your guard still plays Tuesday, so swap after that game.", when: "After Tue" },
  ];
  return (
    <Frame title="This week · your league · 4 pickups left">
      <ul className="divide-y divide-line">
        {moves.map((m) => (
          <li key={m.add.name} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-center gap-3">
              <Face id={m.add.id} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm"><span className="text-[10px] font-semibold uppercase text-accent">Add</span> <span className="font-medium">{m.add.name}</span></div>
                <div className="truncate text-[11px] text-muted">{m.add.meta} · drop {m.drop}</div>
              </div>
              <div className="text-right">
                <div className="text-base font-medium tabular-nums">+{m.gain}</div>
                {m.when && <div className="rounded bg-sunken px-1.5 text-[10px] font-semibold uppercase">{m.when}</div>}
              </div>
            </div>
            <p className="mt-1.5 text-[11px] text-muted">{m.note}</p>
          </li>
        ))}
      </ul>
      <div className="mt-3 rounded-lg border border-line bg-bg px-3 py-2 text-xs text-muted">
        Telegram · 7:02 AM — <span className="text-fg">Add Day&apos;Ron Sharpe, drop your 2-game big: +42 pts</span>
      </div>
    </Frame>
  );
}

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ animationDelay: "260ms" }} className="animate-fade-up rounded-2xl border border-line bg-panel shadow-[0_20px_60px_rgba(25,25,25,0.10)]">
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
