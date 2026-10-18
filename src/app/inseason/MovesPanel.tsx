'use client';

import type { MatchupGamesComparison, MatchupSideGames } from '@/types';
import type { StreamingPlan, StreamMove, WatchlistNote } from '@/lib/inseason/streaming';
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
        </div>
        <div className="col-span-2 col-start-1 row-start-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1">
          <Who
            id={m.drop.id}
            name={m.drop.name}
            team={m.drop.nbaTeamAbbrev}
            tone="drop"
            meta={`${m.drop.nbaTeamAbbrev ?? ''} · ${m.drop.gamesLeft} games left${m.drop.gamesNext !== undefined ? ` · ${m.drop.gamesNext} next wk` : ''} · ${m.drop.fppg} pts/g`}
          />
        </div>
        <div className="col-start-2 row-start-1 text-right sm:col-start-3">
          <div className="text-lg font-medium tabular-nums tracking-tight">+{Math.round(m.pointsGain)}</div>
          <div className="text-[11px] uppercase tracking-wide text-muted">pts</div>
          {m.swapAfter && (
            <div className="mt-1 whitespace-nowrap rounded bg-sunken px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fg">
              After {m.swapAfter.label.split(',')[0]}
            </div>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">
        <span className="mr-1.5 rounded bg-sunken px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fg">
          {m.kind === 'upgrade' ? 'Upgrade' : 'Stream'}
        </span>
        {m.reason}
      </p>
      {m.nextWeekWarning && <p className="mt-1 text-xs font-medium text-red-700">{m.nextWeekWarning}</p>}
      {m.keepWarning && <p className="mt-1 text-xs font-medium text-red-700">{m.keepWarning}</p>}
    </div>
  );
}

export function StatStrip({ plan, mg }: { plan: StreamingPlan; mg?: MatchupGamesComparison }) {
  const gain = plan.after.points - plan.baseline.points;
  const items = [
    {
      k: mg?.opponent ? `Usable games vs ${mg.opponent.name}` : 'Usable games left',
      v: mg?.opponent ? `${mg.me.usableGames}–${mg.opponent.usableGames}` : String(plan.baseline.usableGames),
    },
    { k: plan.pointsLeague ? 'Points from moves' : 'Games from moves', v: gain > 0 ? `+${gain}` : '0' },
    { k: 'Pickups left', v: plan.addsLeft === null ? 'No limit' : String(plan.addsLeft) },
  ];
  return (
    <dl className="grid grid-cols-3 divide-x divide-line rounded-xl border border-line bg-panel text-center shadow-[0_1px_2px_rgba(25,25,25,0.04)]">
      {items.map((x) => (
        <div key={x.k} className="px-2 py-4 sm:px-6">
          <dd className="text-2xl font-medium tracking-tight tabular-nums">{x.v}</dd>
          <dt className="mt-0.5 text-[11px] uppercase leading-tight tracking-wide text-muted">{x.k}</dt>
        </div>
      ))}
    </dl>
  );
}

function SideTable({ side, days, today }: { side: MatchupSideGames; days: MatchupGamesComparison['days']; today: number }) {
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
        </tbody>
      </table>
    </div>
  );
}

export function MatchupGamesPanel({ data }: { data: MatchupGamesComparison }) {
  const { me, opponent, days, today, startingSlots } = data;
  const range = days.length ? `${dayLabel(days[0].date)} ${days[0].date.slice(5)} – ${dayLabel(days[days.length - 1].date)} ${days[days.length - 1].date.slice(5)}` : '';
  return (
    <Panel
      title="Games this week"
      sub={`Usable games cap each day at your ${startingSlots} starters. Injured and IR players don’t count.`}
      right={range}
    >
      <div className={`grid gap-6 ${opponent ? 'lg:grid-cols-2' : ''}`}>
        <SideTable side={me} days={days} today={today} />
        {opponent && <SideTable side={opponent} days={days} today={today} />}
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
                {w.player.nbaTeamAbbrev} · {w.player.gamesLeft} left{w.player.gamesNext !== undefined ? ` · ${w.player.gamesNext} next wk` : ''} · {w.player.fppg} pts/g{w.player.onWaivers ? ' · waivers' : ''}
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
