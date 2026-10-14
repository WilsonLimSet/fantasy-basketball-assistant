'use client';

import { useEffect, useState } from 'react';
import { Gate, useMe } from '../useMe';

interface LookupTeam { id: number; name: string; abbrev: string; managers: string[] }
interface RosterPlayer { id: number; name: string; nbaTeamAbbrev?: string; positions: string[]; status: string; fppg: number; injuredReserve: boolean }

const label: React.CSSProperties = { display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' };
const input: React.CSSProperties = {
  width: '100%', padding: '0.55rem 0.7rem', border: '1px solid var(--card-border)', borderRadius: '0.5rem',
  fontSize: '0.9rem', background: '#fff', marginBottom: '0.9rem',
};

function LeagueForm({ onSaved, existing }: { onSaved: () => void; existing?: { leagueId: string; hasLogin: boolean } }) {
  const [link, setLink] = useState(existing?.leagueId ?? '');
  const [s2, setS2] = useState('');
  const [swid, setSwid] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [teams, setTeams] = useState<LookupTeam[] | null>(null);
  const [leagueId, setLeagueId] = useState('');
  const [leagueName, setLeagueName] = useState('');
  const [teamId, setTeamId] = useState<number | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const post = async (body: object) => {
    const r = await fetch('/api/inseason/me', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return r.json();
  };

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const j = await post({ action: 'lookup', link, s2, swid });
    setBusy(false);
    if (!j.success) {
      setError(j.error);
      if (/private|cookies/i.test(j.error ?? '')) setShowLogin(true);
      return;
    }
    setTeams(j.teams); setLeagueId(j.leagueId); setLeagueName(j.leagueName); setTeamId(j.teamId ?? '');
  };

  const save = async () => {
    if (!teamId) return;
    setBusy(true); setError(null);
    const j = await post({ action: 'save', leagueId, teamId, s2, swid });
    setBusy(false);
    if (j.success) onSaved(); else setError(j.error);
  };

  return (
    <div className="card">
      <div className="card-header"><h2 className="card-title">Your ESPN league</h2></div>
      {!teams ? (
        <form onSubmit={lookup}>
          <label style={label} htmlFor="link">ESPN team link or league ID</label>
          <input id="link" style={input} value={link} onChange={(e) => setLink(e.target.value)}
            placeholder="https://fantasy.espn.com/basketball/team?leagueId=…&teamId=…" />
          <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '-0.5rem', marginBottom: '0.9rem' }}>
            Open your team on ESPN and copy the address bar.
          </p>
          {showLogin ? (
            <div className="alert alert-info" style={{ marginBottom: '0.9rem' }}>
              <p style={{ marginBottom: '0.6rem' }}>
                Private leagues need your ESPN login cookies so we can read the league each morning. They&apos;re stored
                encrypted and only used to read your league; we never make moves for you.
              </p>
              <p style={{ fontSize: '0.8rem', marginBottom: '0.6rem' }}>
                On a computer: sign in at fantasy.espn.com, open Developer Tools (F12) → Application → Cookies →
                fantasy.espn.com, and copy <code>espn_s2</code> and <code>SWID</code>.
              </p>
              <label style={label} htmlFor="s2">espn_s2</label>
              <input id="s2" style={input} value={s2} onChange={(e) => setS2(e.target.value)} autoComplete="off" />
              <label style={label} htmlFor="swid">SWID</label>
              <input id="swid" style={{ ...input, marginBottom: 0 }} value={swid} onChange={(e) => setSwid(e.target.value)} placeholder="{XXXXXXXX-XXXX-…}" autoComplete="off" />
            </div>
          ) : (
            <button type="button" onClick={() => setShowLogin(true)} style={{ background: 'none', border: 'none', color: 'var(--muted)', textDecoration: 'underline', fontSize: '0.8rem', marginBottom: '0.9rem', cursor: 'pointer' }}>
              {existing?.hasLogin ? 'Update ESPN login (private league)' : 'Private league? Add your ESPN login'}
            </button>
          )}
          {error && <div className="alert alert-danger" style={{ marginBottom: '0.9rem' }}>{error}</div>}
          <div><button className="btn btn-primary" disabled={busy || !link.trim()}>{busy ? 'Checking…' : 'Find my league'}</button></div>
        </form>
      ) : (
        <div>
          <p style={{ marginBottom: '0.9rem' }}><strong>{leagueName || `League ${leagueId}`}</strong> · {teams.length} teams</p>
          <label style={label} htmlFor="team">Which team is yours?</label>
          <select id="team" style={input} value={teamId} onChange={(e) => setTeamId(Number(e.target.value))}>
            <option value="">Pick your team</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}{t.managers.length ? ` (${t.managers.join(', ')})` : ''}</option>
            ))}
          </select>
          {error && <div className="alert alert-danger" style={{ marginBottom: '0.9rem' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary" onClick={save} disabled={busy || !teamId}>{busy ? 'Loading your league…' : 'Connect'}</button>
            <button className="btn btn-secondary" onClick={() => setTeams(null)} disabled={busy}>Back</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CorePicker({ core: savedCore }: { core: number[] }) {
  const [roster, setRoster] = useState<RosterPlayer[] | null>(null);
  const [core, setCore] = useState<Set<number>>(new Set(savedCore));
  const [defaulted, setDefaulted] = useState(false);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    fetch('/api/inseason/moves').then((r) => r.json()).then((j) => {
      if (!j.success) return;
      setRoster(j.roster);
      if (!savedCore.length && j.plan) { setCore(new Set(j.plan.core)); setDefaulted(true); }
    });
  }, [savedCore.length]);

  const toggle = (id: number) => {
    setState('idle');
    setCore((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const save = async () => {
    setState('saving');
    await fetch('/api/inseason/me', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ core: [...core] }) });
    setState('saved'); setDefaulted(false);
  };

  if (!roster) return null;
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Core players</h2>
        <span className="card-subtitle">{core.size} kept</span>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '0.9rem' }}>
        Check the players you&apos;re keeping no matter what. Everyone else is a streaming spot, and we&apos;ll suggest
        swapping them for players with more games.
        {defaulted && ' We started you with your top players by projection.'}
      </p>
      {roster.map((p) => (
        <label key={p.id} className="player-row" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={core.has(p.id)} onChange={() => toggle(p.id)} style={{ marginRight: '0.75rem' }} />
          <div className="player-info">
            <div className="player-name">{p.name}</div>
            <div className="player-meta">
              {p.nbaTeamAbbrev} · {p.positions.join('/')}{p.status !== 'ACTIVE' ? ` · ${p.status.replace(/_/g, ' ')}` : ''}{p.injuredReserve ? ' · IR' : ''}
            </div>
          </div>
          <div className="player-score">{p.fppg}</div>
        </label>
      ))}
      <div style={{ marginTop: '1rem' }}>
        <button className="btn btn-primary" onClick={save} disabled={state === 'saving'}>
          {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : 'Save core players'}
        </button>
      </div>
    </div>
  );
}

function Alerts({ on, available }: { on: boolean; available: boolean }) {
  const [email, setEmail] = useState(on);
  const set = async (v: boolean) => {
    setEmail(v);
    await fetch('/api/inseason/me', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ alerts: { email: v } }) });
  };
  return (
    <div className="card">
      <div className="card-header"><h2 className="card-title">Morning email</h2></div>
      <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', cursor: 'pointer' }}>
        <input type="checkbox" checked={email} onChange={(e) => set(e.target.checked)} />
        <span>Email me the day&apos;s best add/drops (about 7am New York time, only when there&apos;s a move worth making)</span>
      </label>
      {!available && <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '0.6rem' }}>Emails start once sending is switched on.</p>}
    </div>
  );
}

export default function ConnectPage() {
  const { me, reload } = useMe();
  const [editing, setEditing] = useState(false);

  if (!me) return <div className="loading"><div className="spinner" />Loading…</div>;
  if (!me.signedIn) return <Gate needs="signin" />;

  const profile = me.profile;
  const disconnect = async () => {
    await fetch('/api/inseason/me', { method: 'DELETE' });
    await reload();
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title">Connect ESPN</h1>
        <p className="page-subtitle">Signed in as {me.email}</p>
      </div>

      {profile && !editing ? (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">{profile.teamName ?? `Team ${profile.teamId}`}</h2>
            <span className="card-subtitle">{profile.leagueName || `League ${profile.leagueId}`}</span>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            {profile.hasLogin ? 'Private league, ESPN login saved (encrypted).' : 'Read without an ESPN login.'} We refresh it twice a day.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <a className="btn btn-primary" href="/inseason">See this week&apos;s moves</a>
            <button className="btn btn-secondary" onClick={() => setEditing(true)}>Change league</button>
            <button className="btn btn-secondary" onClick={disconnect}>Disconnect</button>
          </div>
        </div>
      ) : (
        <LeagueForm
          existing={profile ? { leagueId: profile.leagueId, hasLogin: profile.hasLogin } : undefined}
          onSaved={async () => { setEditing(false); await reload(); }}
        />
      )}

      {profile && !editing && (
        <>
          {me.pro ? <CorePicker key={`${profile.leagueId}-${profile.teamId}`} core={profile.core} /> : <Gate needs="pro" me={me} />}
          <Alerts on={profile.alerts.email} available={!!me.emailAlerts} />
        </>
      )}
    </div>
  );
}
