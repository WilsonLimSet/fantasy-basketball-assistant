'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DailyBriefing, StatusChange, WaiverRecommendation, InjuryOpportunity } from '@/types';

interface BriefingResponse {
  success: boolean;
  briefing?: DailyBriefing;
  snapshotAge?: number;
  error?: string;
}

function StatusBadge({ status }: { status: string }) {
  const statusClass = {
    ACTIVE: 'status-active',
    DAY_TO_DAY: 'status-dtd',
    OUT: 'status-out',
    INJURY_RESERVE: 'status-ir',
    QUESTIONABLE: 'status-dtd',
    DOUBTFUL: 'status-out',
    PROBABLE: 'status-active',
    SUSPENSION: 'status-out',
  }[status] || 'status-dtd';

  return (
    <span className={`status ${statusClass}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function formatAge(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ago`;
  }
  return `${minutes}m ago`;
}

function StatusChangeCard({ changes }: { changes: StatusChange[] }) {
  const myChanges = changes.filter((c) => c.isMyPlayer);

  if (myChanges.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Status Changes</h2>
        </div>
        <p style={{ color: 'var(--muted)' }}>No status changes for your players</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">🔴 Roster Alerts</h2>
        <span className="card-subtitle">{myChanges.length} change(s)</span>
      </div>
      {myChanges.map((change) => (
        <div key={change.playerId} className="action-item">
          <div>
            <strong>{change.playerName}</strong>
            <div style={{ marginTop: '0.25rem' }}>
              <StatusBadge status={change.previousStatus} />
              <span style={{ margin: '0 0.5rem', color: 'var(--muted)' }}>→</span>
              <StatusBadge status={change.currentStatus} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActionItemsCard({ items }: { items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Action Items</h2>
      </div>
      {items.map((item, idx) => (
        <div key={idx} className="action-item">
          {item}
        </div>
      ))}
    </div>
  );
}

function TopAddsCard({ recommendations }: { recommendations: WaiverRecommendation[] }) {
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Top Waiver Adds</h2>
        <a href="/waivers" style={{ fontSize: '0.875rem' }}>View All →</a>
      </div>
      {recommendations.slice(0, 3).map((rec) => (
        <div key={rec.player.id} className="player-row">
          <div className="player-rank">#{rec.rank}</div>
          <div className="player-info">
            <div className="player-name">
              {rec.player.name}
              <span className={`confidence confidence-${rec.confidence.toLowerCase()}`} style={{ marginLeft: '0.5rem' }}>
                {rec.confidence}
              </span>
            </div>
            <div className="player-meta">
              {rec.player.nbaTeamAbbrev} • {rec.player.positions.join('/')} • {rec.gamesNext7} games
            </div>
            <div className="player-reasons">
              {rec.reasons.slice(0, 2).map((reason, idx) => (
                <span key={idx} className="reason-tag">{reason}</span>
              ))}
            </div>
          </div>
          <div className="player-score">{rec.score.toFixed(1)}</div>
        </div>
      ))}
    </div>
  );
}

function InjuryOpportunityCard({ opportunities }: { opportunities: InjuryOpportunity[] }) {
  if (opportunities.length === 0) {
    return null;
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">🏥 Injury Opportunities</h2>
      </div>
      {opportunities.map((opp) => (
        <div key={opp.injuredPlayer.id} style={{ marginBottom: '1rem' }}>
          <div style={{ marginBottom: '0.5rem' }}>
            <strong>{opp.injuredPlayer.name}</strong> ({opp.injuredPlayer.nbaTeamAbbrev})
            <StatusBadge status={opp.injuryStatus} />
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>
            Consider adding:
          </div>
          {opp.beneficiaries.map((ben) => (
            <div key={ben.player.id} style={{ paddingLeft: '1rem', marginBottom: '0.25rem' }}>
              → <strong>{ben.player.name}</strong>
              <span className={`confidence confidence-${ben.confidence.toLowerCase()}`} style={{ marginLeft: '0.5rem' }}>
                {ben.confidence}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [snapshotAge, setSnapshotAge] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBriefing = useCallback(async () => {
    try {
      const res = await fetch('/api/briefing');
      const data: BriefingResponse = await res.json();

      if (data.success && data.briefing) {
        setBriefing(data.briefing);
        setSnapshotAge(data.snapshotAge || 0);
        setError(null);
      } else {
        setError(data.error || 'Failed to load briefing');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/refresh', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        await fetchBriefing();
      } else {
        setError(data.error || 'Refresh failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBriefing();
  }, [fetchBriefing]);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        Loading briefing...
      </div>
    );
  }

  if (error && !briefing) {
    return (
      <div>
        <div className="alert alert-warning">
          <strong>No data available.</strong> {error}
        </div>
        <button className="btn btn-primary" onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? 'Refreshing...' : 'Fetch Data Now'}
        </button>
      </div>
    );
  }

  if (!briefing) {
    return null;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
            Week {briefing.week} Briefing
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
            Updated {formatAge(snapshotAge)}
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? 'Refreshing...' : 'Refresh Now'}
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Stats Overview */}
      <div className="card">
        <div className="grid grid-3">
          <div className="stat">
            <div className="stat-value">{briefing.myTeam.roster?.length || 0}</div>
            <div className="stat-label">Roster Size</div>
          </div>
          <div className="stat">
            <div className="stat-value">
              {briefing.myTeam.record?.wins || 0}-{briefing.myTeam.record?.losses || 0}
            </div>
            <div className="stat-label">Record</div>
          </div>
          <div className="stat">
            <div className="stat-value">{briefing.topWaiverAdds.length}</div>
            <div className="stat-label">Top Waiver Adds</div>
          </div>
        </div>
      </div>

      {/* Action Items */}
      <ActionItemsCard items={briefing.actionItems} />

      {/* Status Changes */}
      <StatusChangeCard changes={briefing.statusChanges} />

      {/* Grid Layout */}
      <div className="grid grid-2">
        {/* Top Adds */}
        <TopAddsCard recommendations={briefing.topWaiverAdds} />

        {/* Injury Opportunities */}
        <InjuryOpportunityCard opportunities={briefing.injuryOpportunities} />
      </div>

      {/* Roster Overview */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">My Roster</h2>
          <span className="card-subtitle">{briefing.myTeam.name}</span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Team</th>
              <th>Pos</th>
              <th>Status</th>
              <th>Slot</th>
            </tr>
          </thead>
          <tbody>
            {briefing.myTeam.roster?.map((entry) => (
              <tr key={entry.playerId}>
                <td><strong>{entry.player.name}</strong></td>
                <td>{entry.player.nbaTeamAbbrev}</td>
                <td>{entry.player.positions.join('/')}</td>
                <td><StatusBadge status={entry.player.status} /></td>
                <td style={{ color: 'var(--muted)' }}>{entry.lineupSlot}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
