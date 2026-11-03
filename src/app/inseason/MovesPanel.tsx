'use client';

import type { MatchupGamesComparison, MatchupSideGames } from '@/types';
import Link from 'next/link';
import type { MoveDay, StreamingPlan, StreamMove, WatchlistNote } from '@/lib/inseason/streaming';
import { Headshot, InjuryBadge, TeamLogo } from '@/components/ui';
import { Panel } from './useMe';

export interface MovesResponse {
  success: boolean;
  plan?: StreamingPlan | null;
  matchupGames?: MatchupGamesComparison;
  teamName?: string;
  espnUrl?: string;
  snapshotAge?: number;
  error?: string;
  needs?: 'signin' | 'pro' | 'connect' | 'refresh';
  /** Without a pass: what the moves would add this week, and the best one. */
  preview?: MovesPreview;
}

export interface MovesPreview {
  week: number;
  daysLeft: number;
  pointsLeague: boolean;
  baseline: StreamingPlan['baseline'];
  after: StreamingPlan['after'];
  moveCount: number;
  firstMove: StreamMove | null;
  teamName?: string;
}

const dayLabel = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

function Who({ id, name, team, meta, tone }: { id: number; name: string; team?: string; meta: string; tone: 'add' | 'drop' }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Headshot id={id} name={name} size={36} />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 truncate text-sm">
          <span className={`text-[10px] font-semibold uppercase tracking-wide ${tone === 'add' ? 'text-accent' : 'text-red-700'}`}>
            {tone === 'add' ? 'Add' : 'Drop'}
          </span>
          <span className="truncate font-medium">{name}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted">
          {team && <TeamLogo team={team} size={12} />}
          <span className="truncate">{meta}</span>
        </div>
      </div>
    </div>
  );
}

/** "Thu, Sat and Sun". */
const dayList = (dates: string[]) => {
  const d = dates.map((x) => dayLabel(x));
  return d.length > 1 ? `${d.slice(0, -1).join(', ')} and ${d.at(-1)}` : d[0] ?? '';
};
const fmt = (n: number) => n.toLocaleString('en-US');

/**
 * A move's days: filled dot when his game makes your lineup, hollow when he plays but sits, blank
 * with no game. For the dropped player, the games you give up.
 */
function DayStrip({ days, tone }: { days: MoveDay[]; tone: 'add' | 'drop' }) {
  if (!days?.length) return null;
  return (
    <div className="mt-1.5 flex gap-1 pl-[46px]" aria-label={tone === 'add' ? 'Games that count' : 'Games you give up'}>
      {days.map((d) => (
        <div key={d.date} className="flex w-6 flex-col items-center gap-0.5" title={`${dayLabel(d.date)}: ${d.counts ? (tone === 'add' ? 'starts' : 'you lose this game') : d.game ? 'plays, but your lineup is full' : 'no game'}`}>
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              d.counts ? (tone === 'add' ? 'bg-accent' : 'bg-red-700') : d.game ? 'border border-muted' : 'bg-line/60'
            }`}
          />
          <span className="text-[9px] uppercase tracking-wide text-muted">{dayLabel(d.date).slice(0, 2)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * The answer first: what the moves add, which days they fill, and what that does to the matchup.
 * Then what's holding the moves back (the core list) and anything that blocks them.
 */
/** The moves' total, as the rows show it (each move's gain assumes the ones before it). */
export const movesGain = (plan: Pick<StreamingPlan, 'moves'>) => Math.round(plan.moves.reduce((s, m) => s + m.pointsGain, 0));

export function EdgeCard({ plan }: { plan: StreamingPlan }) {
  const gain = movesGain(plan);
  const m = plan.matchup;
  const margin = (mine: number) => (m ? mine - m.opponent.projected : 0);
  const say = (mine: number) => {
    const d = margin(mine);
    return d >= 0 ? `up ${fmt(d)}` : `down ${fmt(-d)}`;
  };
  return (
    <div className="animate-fade-up mb-5 rounded-xl border border-line bg-panel px-5 py-4 shadow-[0_1px_2px_rgba(25,25,25,0.04)]">
      <p className="text-lg font-medium tracking-tight">
        {plan.moves.length ? (
          <>
            Your edge this week: <span className="text-accent">+{fmt(gain)} {plan.pointsLeague ? 'pts' : 'games'}</span> from {plan.moves.length} {plan.moves.length === 1 ? 'move' : 'moves'}
            {plan.fillsDays?.length ? `, filling ${dayList(plan.fillsDays)}` : ''}.
          </>
        ) : (
          'No add/drop beats your roster this week.'
        )}
      </p>
      {m && (
        <p className="mt-1 text-sm text-muted">
          Projected final: <span className="font-medium text-fg tabular-nums">{fmt(m.me.projected)}</span> to{' '}
          <span className="tabular-nums">{fmt(m.opponent.projected)}</span> vs {m.opponentName} ({say(m.me.projected)}).
          {plan.moves.length > 0 && (
            <>
              {' '}With the moves: <span className="font-medium text-fg tabular-nums">{fmt(m.me.withMoves)}</span> ({say(m.me.withMoves)}).
            </>
          )}
          {margin(m.me.projected) >= 150 && ' You’re well ahead: only make moves you’d keep anyway.'}
        </p>
      )}
      {plan.coreCost && (
        <p className="mt-2 text-sm">
          <span className="font-medium">Your core list is holding back +{fmt(plan.coreCost.gain)}.</span>{' '}
          <span className="text-muted">
            The moves above can only drop non-core players. Unlocking{' '}
            {plan.coreCost.players.map((p, i) => (
              <span key={p.id}>
                {i > 0 && (i === plan.coreCost!.players.length - 1 ? ' and ' : ', ')}
                {p.name} (+{p.pointsGain} with {p.addName})
              </span>
            ))}{' '}
            would add it.{' '}
          </span>
          <Link href="/inseason/connect" className="underline hover:text-fg">Edit core players</Link>
        </p>
      )}
      {(plan.warnings?.length ?? 0) > 0 && (
        <ul className="mt-2 space-y-1">
          {plan.warnings.map((w) => (
            <li key={w} className="text-sm font-medium text-red-700">⚠ {w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The moves in the order to make them: now, then after a given day's games. */
export function MovePlan({ moves }: { moves: StreamMove[] }) {
  if (moves.length < 2 && !moves.some((m) => m.swapAfter || m.add.onWaivers)) return null;
  const steps = [...moves].sort((a, b) => (a.swapAfter?.date ?? '').localeCompare(b.swapAfter?.date ?? ''));
  return (
    <ol className="mb-4 space-y-1 rounded-lg bg-sunken px-3 py-2.5 text-sm">
      {steps.map((m) => (
        <li key={m.add.id} className="flex gap-2">
          <span className="w-28 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted">{m.swapAfter ? `After ${dayLabel(m.swapAfter.date)}’s games` : 'Now'}</span>
          <span>
            Add <span className="font-medium">{m.add.name}</span>, drop {m.drop.name}
            {m.add.onWaivers && <span className="text-muted"> (waiver claim: about 2 days to clear)</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function MoveRow({ m }: { m: StreamMove }) {
  return (
    <div className="border-t border-line py-3 first:border-t-0 first:pt-0 last:pb-0">
      <div className="grid grid-cols-[1fr_auto] items-center gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div className="col-start-1 row-start-1 min-w-0">
        <Who
          id={m.add.id}
          name={m.add.name}
          team={m.add.nbaTeamAbbrev}
          tone="add"
          meta={`${m.add.nbaTeamAbbrev ?? ''} · ${m.add.gamesLeft} games left${m.add.gamesNext !== undefined ? ` · ${m.add.gamesNext} next wk` : ''} · ${m.add.fppg} pts/g${m.add.onWaivers ? ' · waivers' : ''}`}
        />
        <DayStrip days={m.addDays} tone="add" />
        </div>
        <div className="col-span-2 col-start-1 row-start-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1">
          <Who
            id={m.drop.id}
            name={m.drop.name}
            team={m.drop.nbaTeamAbbrev}
            tone="drop"
            meta={`${m.drop.nbaTeamAbbrev ?? ''} · ${m.drop.gamesLeft} games left${m.drop.gamesNext !== undefined ? ` · ${m.drop.gamesNext} next wk` : ''} · ${m.drop.fppg} pts/g`}
          />
          <DayStrip days={m.dropDays} tone="drop" />
        </div>
        <div className="col-start-2 row-start-1 text-right sm:col-start-3">
          <div className="text-lg font-medium tabular-nums tracking-tight">+{Math.round(m.pointsGain)}</div>
          <div className="text-[11px] uppercase tracking-wide text-muted">proj pts</div>
          {m.swapAfter && (
            <div className="mt-1 whitespace-nowrap rounded bg-sunken px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fg">
              After {m.swapAfter.label.split(',')[0]}
            </div>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">
        <span className="mr-1.5 rounded bg-sunken px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fg">
          {m.kind === 'upgrade' ? 'Upgrade' : m.kind === 'opportunity' ? 'While out' : 'Stream'}
        </span>
        {m.reason}
      </p>
      {m.hold && <p className="mt-1 text-xs font-medium text-fg">{m.hold}</p>}
      {m.nextWeekWarning && <p className="mt-1 text-xs font-medium text-red-700">{m.nextWeekWarning}</p>}
      {m.keepWarning && <p className="mt-1 text-xs font-medium text-red-700">{m.keepWarning}</p>}
    </div>
  );
}

export function StatStrip({ plan, mg }: { plan: StreamingPlan; mg?: MatchupGamesComparison }) {
  const gain = movesGain(plan);
  const items = [
    {
      k: mg?.opponent ? `Usable games vs ${mg.opponent.name}` : 'Usable games left',
      v: mg?.opponent ? `${mg.me.usableGames}–${mg.opponent.usableGames}` : String(plan.baseline.usableGames),
    },
    { k: plan.pointsLeague ? 'Points from moves' : 'Games from moves', v: gain > 0 ? `+${gain}` : '0' },
    { k: 'Pickups left', v: plan.addsLeft === null ? 'No limit' : String(plan.addsLeft) },
  ];
  return (
    <dl className="animate-fade-up grid grid-cols-3 divide-x divide-line rounded-xl border border-line bg-panel text-center shadow-[0_1px_2px_rgba(25,25,25,0.04)]">
      {items.map((x) => (
        <div key={x.k} className="px-2 py-4 sm:px-6">
          <dd className="text-2xl font-medium tracking-tight tabular-nums">{x.v}</dd>
          <dt className="mt-0.5 text-[11px] uppercase leading-tight tracking-wide text-muted">{x.k}</dt>
        </div>
      ))}
    </dl>
  );
}

/** Empty starting spots on each day left with NBA games (none before today or on days off). */
const openByDay = (side: MatchupSideGames, data: Pick<MatchupGamesComparison, 'days' | 'today' | 'startingSlots' | 'teamsPlaying'>) =>
  data.days.map((d, i) => (d.scoringPeriodId < data.today || data.teamsPlaying?.[i] === 0 ? null : data.startingSlots - side.startableByDay[i]));

/** "20 open lineup spots left: Thu 8, Fri 2, Sat 4, Sun 6", and which days are already full. */
function OpenSummary({ side, data }: { side: MatchupSideGames; data: MatchupGamesComparison }) {
  const days = openByDay(side, data).map((open, i) => ({ date: data.days[i].date, open, benched: side.playingByDay[i] - side.startableByDay[i] })).filter((x) => x.open !== null);
  const total = days.reduce((s, x) => s + (x.open ?? 0), 0);
  const full = days.filter((x) => x.benched > 0);
  const day = (date: string) => dayLabel(date).slice(0, 3);
  if (!total) return <p className="mb-4 text-sm text-muted">Your lineup is full every day left this week: a pickup only helps if he beats someone who starts.</p>;
  return (
    <p className="mb-4 text-sm">
      <span className="font-medium">{total} open lineup spots left</span>
      <span className="text-muted">
        {`: ${days.filter((x) => x.open! > 0).map((x) => `${day(x.date)} ${x.open}`).join(', ')}. A pickup adds a game on each of those days he plays.`}
        {full.length ? ` ${full.map((x) => `${day(x.date)} is full (${x.benched} on the bench)`).join(', ')}, so games there add nothing.` : ''}
      </span>
    </p>
  );
}

function SideTable({ side, data }: { side: MatchupSideGames; data: MatchupGamesComparison }) {
  const { days, today, startingSlots } = data;
  const open = openByDay(side, data);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
            <th className="pb-2 font-medium">{side.name}</th>
            <th className="pb-2 text-right font-medium">G</th>
            {days.map((d) => (
              <th key={d.scoringPeriodId} className={`w-8 pb-2 text-center font-medium ${d.scoringPeriodId < today ? 'opacity-40' : ''}`}>
                {dayLabel(d.date).slice(0, 2)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {side.players.map((p) => (
            <tr key={p.playerId} className={`border-t border-line ${p.injured ? 'opacity-40' : ''}`}>
              <td className="max-w-[10rem] truncate py-1.5 pr-2">
                {p.name}
                <InjuryBadge s={p.status} />
              </td>
              <td className={`py-1.5 text-right tabular-nums font-medium ${p.games >= 4 ? 'text-accent' : p.games <= 2 ? 'text-red-700' : ''}`}>{p.games}</td>
              {p.playsByDay.map((plays, i) => (
                <td key={i} className="py-1.5 text-center">
                  {plays ? <span className="inline-block h-1.5 w-1.5 rounded-full bg-fg" /> : <span className="text-line">·</span>}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t border-line text-xs text-muted">
            <td className="py-1.5">Healthy playing</td>
            <td className="py-1.5 text-right tabular-nums font-medium text-fg">{side.totalGames}</td>
            {side.playingByDay.map((n, i) => (
              <td key={i} className="py-1.5 text-center tabular-nums">{n}</td>
            ))}
          </tr>
          <tr className="text-xs text-muted">
            <td className="py-1.5">Can start</td>
            <td className="py-1.5 text-right tabular-nums font-medium text-fg">{side.usableGames}</td>
            {side.startableByDay.map((n, i) => (
              // Darker where positions (not just the 10-spot cap) leave someone on the bench.
              <td key={i} className={`py-1.5 text-center tabular-nums ${n < Math.min(side.playingByDay[i], startingSlots) ? 'font-medium text-fg' : ''}`}>{n}</td>
            ))}
          </tr>
          <tr className="text-xs text-muted">
            <td className="py-1.5">Open spots</td>
            <td className="py-1.5 text-right tabular-nums font-medium text-fg">{open.reduce<number>((sum, n) => sum + (n ?? 0), 0)}</td>
            {open.map((n, i) => (
              // Empty starting spots left this week: where a pickup adds games.
              <td key={i} className={`py-1.5 text-center tabular-nums ${n ? 'font-medium text-accent' : ''}`}>{n ?? ''}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function MatchupGamesPanel({ data }: { data: MatchupGamesComparison }) {
  const { me, opponent, days, startingSlots } = data;
  const range = days.length ? `${dayLabel(days[0].date)} ${days[0].date.slice(5)} – ${dayLabel(days[days.length - 1].date)} ${days[days.length - 1].date.slice(5)}` : '';
  return (
    <Panel
      title="Games this week"
      sub={`Usable games: who can actually start each day, fitted into your ${startingSlots} lineup spots by position (PG, SG, SF, PF, C, G, F, UTIL). Injured and IR players don’t count.`}
      right={range}
    >
      <OpenSummary side={me} data={data} />
      <div className={`grid gap-6 ${opponent ? 'lg:grid-cols-2' : ''}`}>
        <SideTable side={me} data={data} />
        {opponent && <SideTable side={opponent} data={data} />}
      </div>
    </Panel>
  );
}

export function WatchlistPanel({ notes }: { notes: WatchlistNote[] }) {
  const list = notes.filter((w) => !w.rostered).slice(0, 12);
  if (!list.length) return null;
  return (
    <Panel title="Watchlist" sub="Synced from your ESPN watchlist">
      <ul className="-my-1">
        {list.map((w) => (
          <li key={w.player.id} className="flex items-center gap-2.5 border-t border-line py-2 first:border-t-0">
            <Headshot id={w.player.id} name={w.player.name} size={28} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{w.player.name}<InjuryBadge s={w.player.status} /></div>
              <div className="truncate text-xs text-muted">
                {w.player.nbaTeamAbbrev} · {w.player.gamesLeft} left{w.player.gamesNext !== undefined ? ` · ${w.player.gamesNext} next wk` : ''} · {w.player.fppg} pts/g{w.player.onWaivers ? ' · waivers' : ''}{w.player.opportunity ? ` · ${w.player.opportunity}` : ''}
              </div>
            </div>
            <div className="text-right text-xs">
              {w.bestMove ? (
                <>
                  <div className="font-medium tabular-nums text-fg">+{Math.round(w.bestMove.pointsGain)}</div>
                  <div className="text-muted">for {w.bestMove.drop.name}</div>
                </>
              ) : (
                <span className="text-muted">Hold</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
