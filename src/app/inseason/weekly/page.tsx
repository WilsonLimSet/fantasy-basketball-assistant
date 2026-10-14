'use client';

import { useState, useEffect } from 'react';
import type { WeeklyStreamingPlan, NBATeamSchedule, WaiverRecommendation, MatchupGamesComparison, MatchupSideGames } from '@/types';

interface WeeklyPlanResponse {
  success: boolean;
  plan?: WeeklyStreamingPlan;
  scheduleIndex?: Record<number, NBATeamSchedule>;
  topPicksByGames?: WaiverRecommendation[];
  matchupGames?: MatchupGamesComparison;
  snapshotAge?: number;
  error?: string;
}

function formatAge(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ago`;
  }
  return `${minutes}m ago`;
}

function gamesColor(games: number): string {
  if (games >= 4) return 'var(--success)';
  if (games <= 2) return 'var(--danger)';
  return 'inherit';
}

function dayLabel(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

function MatchupSide({ side, days, today }: { side: MatchupSideGames; days: MatchupGamesComparison['days']; today: number }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="table">
        <thead>
          <tr>
            <th>{side.name}</th>
            <th>Games</th>
            {days.map((d) => (
              <th key={d.scoringPeriodId} style={{ textAlign: 'center', minWidth: '2.5rem', opacity: d.scoringPeriodId < today ? 0.5 : 1 }}>
                {dayLabel(d.date)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {side.players.map((p) => (
            <tr key={p.playerId} style={{ opacity: p.injured ? 0.5 : 1 }}>
              <td>
                <strong>{p.name}</strong>
                <span style={{ color: 'var(--muted)', marginLeft: '0.4rem', fontSize: '0.8rem' }}>
                  {p.nbaTeamAbbrev}
                  {p.status !== 'ACTIVE' && ` · ${p.status.replace(/_/g, ' ')}`}
                </span>
              </td>
              <td style={{ fontWeight: 600, color: gamesColor(p.games) }}>{p.games}</td>
              {p.playsByDay.map((plays, i) => (
                <td key={i} style={{ textAlign: 'center' }}>
                  {plays ? <span style={{ fontWeight: 600 }}>●</span> : <span style={{ color: 'var(--card-border)' }}>-</span>}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td style={{ color: 'var(--muted)' }}>Healthy players playing</td>
            <td style={{ fontWeight: 600 }}>{side.totalGames}</td>
            {side.playingByDay.map((n, i) => (
              <td key={i} style={{ textAlign: 'center', fontWeight: 600 }}>{n}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function MatchupGamesCard({ data }: { data: MatchupGamesComparison }) {
  const { me, opponent, days, today, startingSlots } = data;
  const fourPlus = me.players.filter((p) => p.games >= 4 && !p.injured).length;
  const three = me.players.filter((p) => p.games === 3 && !p.injured).length;
  const range = days.length ? `${dayLabel(days[0].date)} ${days[0].date.slice(5)} – ${dayLabel(days[days.length - 1].date)} ${days[days.length - 1].date.slice(5)}` : '';
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Your matchup: games this week</h2>
        <span className="card-subtitle">{range}</span>
      </div>
      <div className="grid grid-3" style={{ marginBottom: '1rem' }}>
        <div className="stat">
          <div className="stat-value">{me.usableGames}{opponent && <span style={{ color: 'var(--muted)' }}> – {opponent.usableGames}</span>}</div>
          <div className="stat-label">Usable games{opponent ? ' (you – them)' : ''}</div>
        </div>
        <div className="stat">
          <div className="stat-value" style={{ color: 'var(--success)' }}>{fourPlus}</div>
          <div className="stat-label">Your 4+ game players</div>
        </div>
        <div className="stat">
          <div className="stat-value">{three}</div>
          <div className="stat-label">Your 3-game players</div>
        </div>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
        Usable games cap each day at your {startingSlots} starting spots, so extra players on a busy day don&apos;t count.
        Injured and IR players are left out of the totals.
      </p>
      <MatchupSide side={me} days={days} today={today} />
      {opponent && <div style={{ marginTop: '1.5rem' }}><MatchupSide side={opponent} days={days} today={today} /></div>}
    </div>
  );
}

export default function WeeklyPlanPage() {
  const [data, setData] = useState<WeeklyPlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPlan() {
      try {
        const res = await fetch('/api/inseason/weekly-plan');
        const json: WeeklyPlanResponse = await res.json();

        if (json.success) {
          setData(json);
        } else {
          setError(json.error || 'Failed to load plan');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Network error');
      } finally {
        setLoading(false);
      }
    }

    fetchPlan();
  }, []);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        Loading weekly plan...
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger">
        {error}
      </div>
    );
  }

  const scheduleIndex = data?.scheduleIndex || {};
  const topPicks = data?.topPicksByGames || [];

  // Sort teams by games this week
  const teamSchedules = Object.values(scheduleIndex)
    .filter(t => t.gamesNext7Days > 0)
    .sort((a, b) => b.gamesNext7Days - a.gamesNext7Days);

  // Group by game count
  const fourGameTeams = teamSchedules.filter(t => t.gamesNext7Days >= 4);
  const threeGameTeams = teamSchedules.filter(t => t.gamesNext7Days === 3);
  const twoGameTeams = teamSchedules.filter(t => t.gamesNext7Days <= 2);

  // Get dates for next 7 days
  const dates: string[] = [];
  const dayNames: string[] = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const date = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
    dates.push(date.toISOString().split('T')[0]);
    dayNames.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title">Weekly Schedule</h1>
        <p className="page-subtitle">
          Week {data?.plan?.week || '-'} • Updated {formatAge(data?.snapshotAge || 0)}
        </p>
      </div>

      {data?.matchupGames && <MatchupGamesCard data={data.matchupGames} />}

      {/* Summary Stats */}
      <div className="card">
        <div className="grid grid-3">
          <div className="stat">
            <div className="stat-value" style={{ color: 'var(--success)' }}>
              {fourGameTeams.length}
            </div>
            <div className="stat-label">4-Game Teams</div>
          </div>
          <div className="stat">
            <div className="stat-value">{threeGameTeams.length}</div>
            <div className="stat-label">3-Game Teams</div>
          </div>
          <div className="stat">
            <div className="stat-value" style={{ color: 'var(--danger)' }}>
              {twoGameTeams.length}
            </div>
            <div className="stat-label">2-Game Teams</div>
          </div>
        </div>
      </div>

      {/* 4-Game Teams - Target for Streaming */}
      {fourGameTeams.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">4-Game Teams (Best for Streaming)</h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Games</th>
                  {dayNames.map((day, i) => (
                    <th key={i} style={{ textAlign: 'center', minWidth: '3rem' }}>{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fourGameTeams.map((team) => (
                  <tr key={team.teamId}>
                    <td><strong>{team.teamAbbrev}</strong></td>
                    <td>
                      <span style={{
                        background: 'rgba(22, 163, 74, 0.1)',
                        color: 'var(--success)',
                        padding: '0.125rem 0.5rem',
                        borderRadius: '0.25rem',
                        fontWeight: 600,
                        fontSize: '0.8rem'
                      }}>
                        {team.gamesNext7Days}
                      </span>
                    </td>
                    {dates.map((date, i) => (
                      <td key={i} style={{ textAlign: 'center' }}>
                        {team.gamesByDay[date] ? (
                          <span style={{ color: 'var(--success)', fontWeight: 600 }}>●</span>
                        ) : (
                          <span style={{ color: 'var(--card-border)' }}>-</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Streaming Picks */}
      {topPicks.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Top Streaming Picks</h2>
            <span className="card-subtitle">Players on 4-game teams</span>
          </div>
          {topPicks.slice(0, 8).map((rec) => (
            <div key={rec.player.id} className="player-row">
              <div className="player-rank">#{rec.rank}</div>
              <div className="player-info">
                <div className="player-name">
                  {rec.player.name}
                  <span
                    className={`confidence confidence-${rec.confidence.toLowerCase()}`}
                    style={{ marginLeft: '0.5rem' }}
                  >
                    {rec.confidence}
                  </span>
                </div>
                <div className="player-meta">
                  {rec.player.nbaTeamAbbrev} • {rec.player.positions.join('/')} • {rec.gamesNext7} games
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="player-score">{rec.score.toFixed(1)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3-Game Teams */}
      {threeGameTeams.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">3-Game Teams</h2>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {threeGameTeams.map((team) => (
              <span
                key={team.teamId}
                style={{
                  padding: '0.25rem 0.75rem',
                  background: 'var(--muted-bg)',
                  borderRadius: '1rem',
                  fontSize: '0.85rem',
                  border: '1px solid var(--card-border)'
                }}
              >
                {team.teamAbbrev}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 2-Game Teams - Avoid */}
      {twoGameTeams.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">2-Game Teams (Avoid)</h2>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {twoGameTeams.map((team) => (
              <span
                key={team.teamId}
                style={{
                  padding: '0.25rem 0.75rem',
                  background: 'rgba(220, 38, 38, 0.05)',
                  borderRadius: '1rem',
                  fontSize: '0.85rem',
                  color: 'var(--danger)',
                  border: '1px solid rgba(220, 38, 38, 0.2)'
                }}
              >
                {team.teamAbbrev} ({team.gamesNext7Days})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Streaming Strategy</h2>
        </div>
        <ul style={{ paddingLeft: '1.5rem', color: 'var(--muted)', lineHeight: '1.8' }}>
          <li>Target players on <strong style={{ color: 'var(--success)' }}>4-game teams</strong> for maximum value</li>
          <li>You have <strong>5 adds/drops</strong> per week - use them strategically</li>
          <li>Check injury reports before adding - avoid DTD/OUT players</li>
          <li>Prioritize positions where you have bench flexibility</li>
        </ul>
      </div>
    </div>
  );
}
