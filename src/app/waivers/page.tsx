'use client';

import { useState, useEffect } from 'react';
import type { WaiverRecommendation, Player } from '@/types';

interface WaiversResponse {
  success: boolean;
  week?: number;
  recommendations?: WaiverRecommendation[];
  dropCandidates?: Array<{ player: Player; reasons: string[] }>;
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

export default function WaiversPage() {
  const [data, setData] = useState<WaiversResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchWaivers() {
      try {
        const res = await fetch('/api/waivers?limit=20');
        const json: WaiversResponse = await res.json();

        if (json.success) {
          setData(json);
        } else {
          setError(json.error || 'Failed to load waivers');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Network error');
      } finally {
        setLoading(false);
      }
    }

    fetchWaivers();
  }, []);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        Loading waiver recommendations...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="alert alert-danger">
        {error || 'Failed to load data'}
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
          Waiver Wire Scout
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
          Week {data.week} • Updated {formatAge(data.snapshotAge || 0)}
        </p>
      </div>

      {/* Scoring explanation */}
      <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
        <strong>Scoring Formula:</strong> 55% Projected Points × 25% Games Next 7 Days × 20% Recent Trend
      </div>

      {/* Top Recommendations */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Top Waiver Adds</h2>
          <span className="card-subtitle">{data.recommendations?.length || 0} players</span>
        </div>

        {data.recommendations?.map((rec) => (
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
                {rec.player.nbaTeamAbbrev} • {rec.player.positions.join('/')}
              </div>
              <div className="player-reasons">
                {rec.reasons.map((reason, idx) => (
                  <span key={idx} className="reason-tag">{reason}</span>
                ))}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="player-score">{rec.score.toFixed(1)}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                {rec.gamesNext7} games • {rec.projectedPointsNext7.toFixed(1)} pts
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Drop Candidates */}
      {data.dropCandidates && data.dropCandidates.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Consider Dropping</h2>
            <span className="card-subtitle">Potential cuts</span>
          </div>

          {data.dropCandidates.map((candidate) => (
            <div key={candidate.player.id} className="player-row">
              <div className="player-info">
                <div className="player-name">{candidate.player.name}</div>
                <div className="player-meta">
                  {candidate.player.nbaTeamAbbrev} • {candidate.player.positions.join('/')}
                </div>
                <div className="player-reasons">
                  {candidate.reasons.map((reason, idx) => (
                    <span key={idx} className="reason-tag" style={{ background: 'rgba(239, 68, 68, 0.2)' }}>
                      {reason}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
