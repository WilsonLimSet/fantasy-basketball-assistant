'use client';

import { useState, useEffect } from 'react';
import type { WeeklyStreamingPlan, NBATeamSchedule, WaiverRecommendation } from '@/types';

interface WeeklyPlanResponse {
  success: boolean;
  plan?: WeeklyStreamingPlan;
  scheduleIndex?: Record<number, NBATeamSchedule>;
  topPicksByGames?: WaiverRecommendation[];
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

export default function WeeklyPlanPage() {
  const [data, setData] = useState<WeeklyPlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPlan() {
      try {
        const res = await fetch('/api/weekly-plan');
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
