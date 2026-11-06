'use client';

import Link from 'next/link';
import { Headshot, InjuryBadge } from '@/components/ui';
import type { TradeFinder, TradeIdea, TradePlayer } from '@/lib/trades';
import { Gate, Loading, Panel, useCached } from '../useMe';

type TradesResponse = Partial<TradeFinder> & {
  success: boolean;
  error?: string;
  needs?: 'signin' | 'pro' | 'connect';
  leagueId?: number;
  seasonId?: number;
};

const names = (ps: TradePlayer[]) => ps.map((p) => p.name).join(' + ');
const checkUrl = (x: TradeIdea) => `/trade?give=${x.give.map((p) => p.id).join(',')}&get=${x.get.map((p) => p.id).join(',')}`;

function Faces({ ps }: { ps: TradePlayer[] }) {
  return (
    <div className="flex -space-x-2">
      {ps.map((p) => <Headshot key={p.id} id={p.id} name={p.name} size={32} />)}
    </div>
  );
}

function Idea({ x, espn }: { x: TradeIdea; espn?: string }) {
  return (
    <li className="border-t border-line py-4 first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">To {x.teamName}</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-2.5">
              <Faces ps={x.give} />
              <div className="min-w-0 text-sm">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-red-700">Give</span>{' '}
                <span className="font-medium">{names(x.give)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Faces ps={x.get} />
              <div className="min-w-0 text-sm">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-accent">Get</span>{' '}
                <span className="font-medium">{names(x.get)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-medium tabular-nums tracking-tight text-accent">+{x.gain}</div>
          <div className="text-[11px] uppercase tracking-wide text-muted">pts/game</div>
        </div>
      </div>
      <ul className="mt-2 space-y-0.5 text-xs text-muted">
        {x.why.map((w) => <li key={w}>· {w}</li>)}
      </ul>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {espn && <a href={espn} target="_blank" rel="noopener noreferrer" className="btn-accent">Propose on ESPN</a>}
        <Link href={checkUrl(x)} className="btn-ghost">Full breakdown</Link>
      </div>
    </li>
  );
}

function FormRow({ p, sub }: { p: TradePlayer; sub?: string }) {
  return (
    <li className="flex items-center gap-2.5 border-t border-line py-2 first:border-t-0">
      <Headshot id={p.id} name={p.name} size={28} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{p.name}<InjuryBadge s={p.status} /></div>
        <div className="truncate text-xs text-muted">{sub ? `${sub} · ` : ''}{p.team} · {p.pos}</div>
      </div>
      <div className="text-right text-xs">
        <div className="tabular-nums"><span className="font-medium text-fg">{p.recent}</span> <span className="text-muted">lately</span></div>
        <div className="tabular-nums text-muted">{p.perGame} expected</div>
      </div>
    </li>
  );
}

/** Trade ideas for your league: buy low on slumps, sell high on hot streaks, health counted. */
export default function TradesPage() {
  const { data } = useCached<TradesResponse>('/api/inseason/trades');
  if (!data) return <Loading what="trade ideas" />;
  if (data.needs === 'signin' || data.needs === 'pro' || data.needs === 'connect') return <Gate needs={data.needs} />;
  if (!data.success || !data.ideas) return <Panel title="Trades"><p className="text-sm text-muted">{data.error ?? 'No data yet.'}</p></Panel>;
  const espn = (teamId: number) =>
    data.leagueId ? `https://fantasy.espn.com/basketball/team?leagueId=${data.leagueId}&teamId=${teamId}${data.seasonId ? `&seasonId=${data.seasonId}` : ''}` : undefined;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-3xl font-medium leading-tight tracking-[-0.03em]">Trades</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Offers that win for you on rest-of-season points per game (games they&apos;ll miss counted) and look fair to the other manager on
          recent box scores. Buy stars in a slump, sell players running hot. We never suggest trading for someone who&apos;s out long or sits often.
        </p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Panel
          title="Offers to make"
          sub="Best first. The gain is what your team adds per game, the rest of the season."
          right={<Link href="/trade" className="btn-ghost">Check any trade</Link>}
        >
          {data.ideas.length ? (
            <ul>{data.ideas.map((x) => <Idea key={`${x.teamId}:${[...x.give, ...x.get].map((p) => p.id).join(',')}`} x={x} espn={espn(x.teamId)} />)}</ul>
          ) : (
            <p className="text-sm text-muted">No trade beats your roster right now that the other side would take. Check back after a few games: slumps open windows.</p>
          )}
        </Panel>
        <div className="space-y-5">
          {(data.buyLow?.length ?? 0) > 0 && (
            <Panel title="Buy low" sub="League mates' players playing below their role. Ask about them now.">
              <ul className="-my-1">{data.buyLow!.map((p) => <FormRow key={p.id} p={p} sub={p.teamName} />)}</ul>
            </Panel>
          )}
          <Panel title="Sell high" sub="Your players worth more to other managers than to you. Shop them now.">
            {(data.sellHigh?.length ?? 0) > 0 ? (
              <ul className="-my-1">
                {data.sellHigh!.map((p) => (
                  <li key={p.id} className="border-t border-line py-2 first:border-t-0">
                    <div className="flex items-center gap-2.5">
                      <Headshot id={p.id} name={p.name} size={28} />
                      <div className="min-w-0 flex-1 truncate text-sm">{p.name}<InjuryBadge s={p.status} /></div>
                      <div className="text-right text-xs tabular-nums">
                        <div><span className="font-medium text-fg">{Math.round(p.perceived)}</span> <span className="text-muted">they see</span></div>
                        <div className="text-muted">{p.ros} for you</div>
                      </div>
                    </div>
                    <p className="mt-1 pl-[38px] text-xs text-muted">{p.why}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Nobody on your roster is worth much more to others than to you right now.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
