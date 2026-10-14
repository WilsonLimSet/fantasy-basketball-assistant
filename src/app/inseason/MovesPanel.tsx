'use client';

import Link from 'next/link';
import type { MatchupGamesComparison } from '@/types';
import type { StreamingPlan, StreamMove } from '@/lib/inseason/streaming';

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

function MoveRow({ m, i }: { m: StreamMove; i?: number }) {
  return (
    <div className="action-item" style={{ display: 'block' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <div>
          {i !== undefined && <span style={{ color: 'var(--muted)', marginRight: '0.4rem' }}>{i + 1}.</span>}
          <strong style={{ color: 'var(--success)' }}>Add {m.add.name}</strong>
          <span style={{ color: 'var(--muted)' }}> {m.add.nbaTeamAbbrev} · {m.add.positions.join('/')}</span>
          <span style={{ margin: '0 0.4rem', color: 'var(--muted)' }}>for</span>
          <strong style={{ color: 'var(--danger)' }}>{m.drop.name}</strong>
          {m.add.onWaivers && <span className="reason-tag" style={{ marginLeft: '0.5rem' }}>Waivers</span>}
        </div>
        <div style={{ fontWeight: 700 }}>+{Math.round(m.pointsGain)} pts</div>
      </div>
      <div style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '0.3rem' }}>{m.reason}</div>
      <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
        {m.add.name}: {m.add.fppg} pts/game · {m.drop.name}: {m.drop.fppg} pts/game
      </div>
    </div>
  );
}

export function MovesPanel({ data }: { data: MovesResponse }) {
  const { plan, matchupGames: mg, espnUrl } = data;
  if (!plan) return null;
  const gain = plan.after.points - plan.baseline.points;
  const watchHits = plan.watchlist.filter((w) => !w.rostered);

  return (
    <>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">This week&apos;s moves</h2>
          <span className="card-subtitle">
            {plan.daysLeft} days left{plan.addsLeft !== null ? ` · ${plan.addsLeft} pickups left` : ''}
          </span>
        </div>

        <div className="grid grid-3" style={{ marginBottom: '1rem' }}>
          <div className="stat">
            <div className="stat-value">
              {mg?.me.usableGames ?? plan.baseline.usableGames}
              {mg?.opponent && <span style={{ color: 'var(--muted)' }}> – {mg.opponent.usableGames}</span>}
            </div>
            <div className="stat-label">Usable games{mg?.opponent ? ` vs ${mg.opponent.name}` : ''}</div>
          </div>
          <div className="stat">
            <div className="stat-value" style={{ color: gain > 0 ? 'var(--success)' : undefined }}>
              {gain > 0 ? `+${gain}` : '0'}
            </div>
            <div className="stat-label">{plan.pointsLeague ? 'Points from these moves' : 'Games from these moves'}</div>
          </div>
          <div className="stat">
            <div className="stat-value">{plan.after.usableGames - plan.baseline.usableGames >= 0 ? '+' : ''}{plan.after.usableGames - plan.baseline.usableGames}</div>
            <div className="stat-label">Usable games added</div>
          </div>
        </div>

        {plan.moves.length ? (
          plan.moves.map((m, i) => <MoveRow key={m.add.id} m={m} i={plan.moves.length > 1 ? i : undefined} />)
        ) : (
          <p style={{ color: 'var(--muted)' }}>No add/drop beats your current roster this week. Sit tight.</p>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {espnUrl && plan.moves.length > 0 && (
            <a className="btn btn-primary" href={espnUrl} target="_blank" rel="noopener noreferrer">Make moves on ESPN</a>
          )}
          <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
            Streaming spots: {plan.droppable.map((p) => p.name).join(', ') || 'none'}.{' '}
            <Link href="/inseason/connect" style={{ color: 'inherit' }}>
              {plan.coreIsDefault ? 'Pick your core players' : 'Edit core players'}
            </Link>
          </span>
        </div>
      </div>

      {watchHits.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Watchlist</h2>
            <span className="card-subtitle">Synced from your ESPN watchlist</span>
          </div>
          {watchHits.map((w) => (
            <div key={w.player.id} className="player-row">
              <div className="player-info">
                <div className="player-name">{w.player.name}</div>
                <div className="player-meta">
                  {w.player.nbaTeamAbbrev} · {w.player.gamesLeft} games left · {w.player.fppg} pts/game
                  {w.player.onWaivers ? ' · waivers' : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                {w.bestMove ? (
                  <>
                    <div style={{ fontWeight: 700 }}>+{Math.round(w.bestMove.pointsGain)} pts</div>
                    <div style={{ color: 'var(--muted)' }}>for {w.bestMove.drop.name}</div>
                  </>
                ) : (
                  <span style={{ color: 'var(--muted)' }}>Not worth a move this week</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
