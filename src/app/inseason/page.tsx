'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import type { DailyBriefing } from '@/types';
import { InjuryBadge } from '@/components/ui';
import { MatchupGamesPanel, MoveRow, StatStrip, WatchlistPanel, type MovesResponse } from './MovesPanel';
import { ErrorBox, formatAge, Gate, invalidateCached, Loading, MOVES_URL, Panel, useCached, useMeContext } from './useMe';

function RosterAlerts({ briefing }: { briefing: DailyBriefing }) {
  const changes = briefing.statusChanges.filter((c) => c.isMyPlayer);
  const hurt = (briefing.myTeam.roster ?? []).filter((r) => r.player.status !== 'ACTIVE');
  return (
    <Panel title="Roster alerts">
      {changes.length === 0 && hurt.length === 0 ? (
        <p className="text-sm text-muted">Everyone on your roster is healthy.</p>
      ) : (
        <ul className="-my-1 text-sm">
          {changes.map((c) => (
            <li key={`c${c.playerId}`} className="border-t border-line py-2 first:border-t-0">
              <span className="font-medium">{c.playerName}</span>
              <span className="text-muted"> {c.previousStatus.replace(/_/g, ' ').toLowerCase()} → </span>
              <InjuryBadge s={c.currentStatus} />
              {c.currentStatus === 'ACTIVE' && <span className="text-accent">active</span>}
            </li>
          ))}
          {hurt
            .filter((r) => !changes.some((c) => c.playerId === r.playerId))
            .map((r) => (
              <li key={`h${r.playerId}`} className="border-t border-line py-2 first:border-t-0">
                {r.player.name}
                <InjuryBadge s={r.player.status} />
                {r.lineupSlotId === 13 && <span className="ml-1.5 text-xs text-muted">on IR</span>}
              </li>
            ))}
        </ul>
      )}
    </Panel>
  );
}

export default function ThisWeekPage() {
  const { me } = useMeContext();
  const { data: moves, reload: reloadMoves } = useCached<MovesResponse>(MOVES_URL);
  const { data: briefingRes, reload: reloadBriefing } = useCached<{ success: boolean; briefing?: DailyBriefing }>('/api/inseason/briefing');
  const briefing = briefingRes?.success ? briefingRes.briefing ?? null : null;
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => { await Promise.all([reloadMoves(), reloadBriefing()]); }, [reloadMoves, reloadBriefing]);

  const refresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const j = await fetch('/api/inseason/refresh', { method: 'POST' }).then((r) => r.json());
      if (!j.success) setError(j.error ?? 'Refresh failed');
      await load();
      invalidateCached('/api/inseason/weekly-plan');
    } finally {
      setRefreshing(false);
    }
  };

  if (!moves) return <Loading what="your week" kind="week" />;
  const needs = moves.needs;
  if (needs === 'signin' || needs === 'pro' || needs === 'connect') return <Gate needs={needs} />;

  const refreshButton = (
    <button onClick={refresh} disabled={refreshing} className="btn-ghost">
      {refreshing ? 'Refreshing…' : 'Refresh'}
    </button>
  );

  if (!moves.success || !moves.plan) {
    return (
      <div>
        {error && <ErrorBox>{error}</ErrorBox>}
        <Panel title="No league data yet">
          <p className="mb-3 text-sm text-muted">{moves.error ?? 'We couldn’t build this week’s plan yet.'}</p>
          {refreshButton}
        </Panel>
      </div>
    );
  }

  const { plan, matchupGames: mg } = moves;
  return (
    <div>
      {error && <ErrorBox>{error}</ErrorBox>}
      <div className="mb-5 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <h1 className="text-3xl font-medium leading-tight tracking-[-0.03em]">
            Week {plan.week}
            <span className="text-muted"> · {plan.daysLeft} {plan.daysLeft === 1 ? 'day' : 'days'} left</span>
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
            <span>{moves.teamName ?? me?.profile?.teamName}{mg?.opponent ? ` vs ${mg.opponent.name}` : ''}</span>
            <span>Updated {formatAge(moves.snapshotAge ?? 0)}</span>
            {refreshButton}
          </p>
        </div>
        <StatStrip plan={plan} mg={mg} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Panel
            title="Moves for this week"
            sub={plan.moves.length ? 'Best first. Each one assumes the ones above it are made.' : undefined}
            right={
              moves.espnUrl && plan.moves.length > 0 ? (
                <a href={moves.espnUrl} target="_blank" rel="noopener noreferrer" className="btn-accent">Make moves on ESPN</a>
              ) : undefined
            }
          >
            {plan.moves.length ? (
              plan.moves.map((m) => <MoveRow key={m.add.id} m={m} />)
            ) : (
              <p className="text-sm text-muted">No add/drop beats your current roster this week. Sit tight.</p>
            )}
            <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
              Streaming spots: {plan.droppable.map((p) => (p.gamesNext !== undefined ? `${p.name} (${p.gamesNext} next wk)` : p.name)).join(', ') || 'none'}.{' '}
              <Link href="/inseason/connect" className="underline hover:text-fg">
                {plan.coreIsDefault ? 'Pick your core players' : 'Edit core players'}
              </Link>
            </p>
          </Panel>
          {me?.profile && !me.profile.telegram && me.telegramBot && (
            <Link href="/inseason/connect#alerts" className="flex items-center justify-between gap-3 rounded-xl border border-line bg-panel px-4 py-3 text-sm shadow-[0_1px_2px_rgba(25,25,25,0.04)] hover:border-fg/30">
              <span><span className="font-medium">Get these moves on Telegram each morning.</span> <span className="text-muted">Takes 10 seconds.</span></span>
              <span className="btn-ghost shrink-0">Set up</span>
            </Link>
          )}
          {mg && <MatchupGamesPanel data={mg} />}
        </div>
        <div className="space-y-5">
          {briefing && <RosterAlerts briefing={briefing} />}
          <WatchlistPanel notes={plan.watchlist} />
        </div>
      </div>
    </div>
  );
}
