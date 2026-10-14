'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Headshot, InjuryBadge } from '@/components/ui';
import { ErrorBox, Gate, Loading, Panel, useMeContext, type Me, type MeProfile } from '../useMe';

interface LookupTeam { id: number; name: string; abbrev: string; managers: string[] }
interface RosterPlayer { id: number; name: string; nbaTeamAbbrev?: string; positions: string[]; status: string; fppg: number; injuredReserve: boolean }

const post = (method: string, body?: object) =>
  fetch('/api/inseason/me', { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json());

function LeagueForm({ onSaved, onCancel, hasLogin }: { onSaved: () => void; onCancel?: () => void; hasLogin?: boolean }) {
  const [link, setLink] = useState('');
  const [s2, setS2] = useState('');
  const [swid, setSwid] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [teams, setTeams] = useState<LookupTeam[] | null>(null);
  const [leagueId, setLeagueId] = useState('');
  const [leagueName, setLeagueName] = useState('');
  const [teamId, setTeamId] = useState<number | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const j = await post('POST', { action: 'lookup', link, s2, swid });
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
    const j = await post('POST', { action: 'save', leagueId, teamId, s2, swid });
    setBusy(false);
    if (j.success) onSaved(); else setError(j.error);
  };

  return (
    <Panel title="Connect your ESPN league" sub="We read your league twice a day. We never make moves for you.">
      {!teams ? (
        <form onSubmit={lookup} className="max-w-xl space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium" htmlFor="link">ESPN team link or league ID</label>
            <input id="link" className="input w-full py-1.5" value={link} onChange={(e) => setLink(e.target.value)}
              placeholder="https://fantasy.espn.com/basketball/team?leagueId=…&teamId=…" />
            <p className="mt-1 text-xs text-muted">Open your team on ESPN and copy the address bar.</p>
          </div>
          {showLogin ? (
            <div className="space-y-2 rounded-lg border border-line bg-sunken p-3">
              <p className="text-xs text-muted">
                Private leagues need your ESPN login cookies so we can read the league each morning. They’re stored
                encrypted and only used to read your league. On a computer: sign in at fantasy.espn.com, open
                Developer Tools → Application → Cookies → fantasy.espn.com, and copy <code>espn_s2</code> and <code>SWID</code>.
              </p>
              <input aria-label="espn_s2" className="input w-full py-1.5" value={s2} onChange={(e) => setS2(e.target.value)} placeholder="espn_s2" autoComplete="off" />
              <input aria-label="SWID" className="input w-full py-1.5" value={swid} onChange={(e) => setSwid(e.target.value)} placeholder="SWID {XXXXXXXX-XXXX-…}" autoComplete="off" />
            </div>
          ) : (
            <button type="button" onClick={() => setShowLogin(true)} className="text-xs text-muted underline hover:text-fg">
              {hasLogin ? 'Update your ESPN login (private league)' : 'Private league? Add your ESPN login'}
            </button>
          )}
          {error && <ErrorBox>{error}</ErrorBox>}
          <div className="flex gap-2">
            <button className="btn-accent px-4 py-1.5 text-sm" disabled={busy || !link.trim()}>{busy ? 'Checking…' : 'Find my league'}</button>
            {onCancel && <button type="button" className="btn-ghost px-4 py-1.5 text-sm" onClick={onCancel}>Cancel</button>}
          </div>
        </form>
      ) : (
        <div className="max-w-xl space-y-3">
          <p className="text-sm"><span className="font-medium">{leagueName || `League ${leagueId}`}</span> <span className="text-muted">· {teams.length} teams</span></p>
          <div>
            <label className="mb-1 block text-xs font-medium" htmlFor="team">Which team is yours?</label>
            <select id="team" className="input w-full py-1.5" value={teamId} onChange={(e) => setTeamId(Number(e.target.value))}>
              <option value="">Pick your team</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.managers.length ? ` (${t.managers.join(', ')})` : ''}</option>
              ))}
            </select>
          </div>
          {error && <ErrorBox>{error}</ErrorBox>}
          <div className="flex gap-2">
            <button className="btn-accent px-4 py-1.5 text-sm" onClick={save} disabled={busy || !teamId}>{busy ? 'Loading your league…' : 'Connect'}</button>
            <button className="btn-ghost px-4 py-1.5 text-sm" onClick={() => setTeams(null)} disabled={busy}>Back</button>
          </div>
          {busy && <p className="text-xs text-muted">Pulling your roster, free agents and the NBA schedule from ESPN. This takes about 15 seconds.</p>}
        </div>
      )}
    </Panel>
  );
}

function CorePicker({ core: savedCore }: { core: number[] }) {
  const [roster, setRoster] = useState<RosterPlayer[] | null>(null);
  const [core, setCore] = useState<Set<number>>(new Set(savedCore));
  const [defaulted, setDefaulted] = useState(false);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    fetch('/api/inseason/moves', { cache: 'no-store' }).then((r) => r.json()).then((j) => {
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
    await post('PATCH', { core: [...core] });
    setState('saved'); setDefaulted(false);
  };

  if (!roster) return null;
  return (
    <Panel
      title="Core players"
      sub={`Check the players you keep no matter what. Everyone else is a streaming spot.${defaulted ? ' We started you with your top players by projection.' : ''}`}
      right={`${core.size} kept · ${roster.length - core.size} streaming`}
    >
      <ul className="-my-1 grid gap-x-6 sm:grid-cols-2">
        {roster.map((p) => (
          <li key={p.id} className="border-t border-line first:border-t-0 sm:[&:nth-child(2)]:border-t-0">
            <label className="flex cursor-pointer items-center gap-2.5 py-2">
              <input type="checkbox" checked={core.has(p.id)} onChange={() => toggle(p.id)} />
              <Headshot id={p.id} name={p.name} size={28} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{p.name}<InjuryBadge s={p.status} />{p.injuredReserve && <span className="ml-1.5 text-xs text-muted">IR</span>}</div>
                <div className="text-xs text-muted">{p.nbaTeamAbbrev} · {p.positions.join('/')}</div>
              </div>
              <span className="text-sm tabular-nums text-muted">{p.fppg}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center gap-3">
        <button className="btn-accent px-4 py-1.5 text-sm" onClick={save} disabled={state === 'saving'}>
          {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : 'Save core players'}
        </button>
        {state === 'saved' && <Link href="/inseason" className="text-xs text-muted underline hover:text-fg">See this week’s moves</Link>}
      </div>
    </Panel>
  );
}

type Channel = 'email' | 'telegram' | 'both' | 'off';
const CHANNELS: { id: Channel; label: string }[] = [
  { id: 'email', label: 'Email' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'both', label: 'Both' },
  { id: 'off', label: 'Off' },
];

function Alerts({ profile, me, reload }: { profile: MeProfile; me: Me; reload: () => Promise<void> }) {
  const linked = !!profile.telegram;
  const current: Channel =
    profile.alerts.email && profile.alerts.telegram && linked ? 'both'
      : profile.alerts.telegram && linked ? 'telegram'
        : profile.alerts.email ? 'email' : 'off';
  const [choice, setChoice] = useState<Channel>(current);
  const [linking, setLinking] = useState<'idle' | 'ready' | 'waiting' | 'expired'>('idle');
  const [link, setLink] = useState<{ url: string; code: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = async (c: Channel) => {
    await post('PATCH', { alerts: { email: c === 'email' || c === 'both', telegram: c === 'telegram' || c === 'both' } });
    setSaved(true);
    await reload();
  };

  const startLink = async () => {
    setError(null);
    const j = await post('POST', { action: 'telegram-link' });
    if (!j.success) { setError(j.error); return; }
    setLink({ url: j.url, code: j.code });
    setLinking('ready');
  };

  const pick = async (c: Channel) => {
    setChoice(c);
    setSaved(false);
    setError(null);
    if ((c === 'telegram' || c === 'both') && !linked) {
      if (!me.telegramBot) { setError('Telegram alerts aren’t switched on yet.'); return; }
      await startLink(); // saved once Telegram is linked
      return;
    }
    await apply(c);
  };

  // While they're in Telegram, check every few seconds (for up to 3 minutes) whether the link went through.
  useEffect(() => {
    if (linking !== 'ready' && linking !== 'waiting') return;
    let tries = 0;
    const t = setInterval(async () => {
      tries++;
      const j = await post('POST', { action: 'telegram-check' });
      if (j.linked) { clearInterval(t); setLinking('idle'); setLink(null); await apply(choice); }
      else if (!j.success || tries > 60) { clearInterval(t); setLinking('expired'); }
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linking]);

  const unlink = async () => {
    await post('POST', { action: 'telegram-unlink' });
    setChoice(profile.alerts.email ? 'email' : 'off');
    await reload();
  };

  return (
    <Panel title="Daily alerts" sub="Your best add/drops around 7am New York time, only when there’s a move worth making.">
      <div className="inline-flex rounded-full border border-line bg-panel p-0.5 text-sm">
        {CHANNELS.map((c) => (
          <button
            key={c.id}
            onClick={() => pick(c.id)}
            className={`rounded-full px-3 py-1 ${choice === c.id ? 'bg-sunken font-medium text-fg' : 'text-muted hover:text-fg'}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-1.5 text-sm">
        {(choice === 'email' || choice === 'both') && (
          <p className="text-muted">
            Email to <span className="text-fg">{me.email}</span>
            {!me.emailAlerts && ' (sending isn’t switched on yet)'}
          </p>
        )}
        {(choice === 'telegram' || choice === 'both') && (
          linked ? (
            <p className="text-muted">
              Telegram as <span className="text-fg">{profile.telegram?.username ? `@${profile.telegram.username}` : 'your account'}</span>
              <button onClick={unlink} className="ml-2 text-xs underline hover:text-fg">Unlink</button>
            </p>
          ) : link && (linking === 'ready' || linking === 'waiting') ? (
            <div className="rounded-lg border border-line bg-sunken p-3">
              <p className="mb-2">Connect Telegram in one tap:</p>
              <a href={link.url} target="_blank" rel="noopener noreferrer" onClick={() => setLinking('waiting')} className="btn-accent inline-block px-4 py-1.5 text-sm">
                Open Telegram
              </a>
              <p className="mt-2 text-xs text-muted">
                It opens our bot. Press <b>Start</b> and this page updates by itself. Already chatting with the bot? Send it this
                code: <b className="font-mono text-fg">{link.code}</b>
              </p>
            </div>
          ) : (
            <p className="text-muted">
              {linking === 'expired' ? 'Didn’t see your Start. ' : ''}
              <button onClick={startLink} className="btn-ghost">Connect Telegram</button>
            </p>
          )
        )}
        {choice === 'off' && <p className="text-muted">No alerts. You can still check This week any time.</p>}
        {saved && <p className="text-xs text-accent">Saved.</p>}
        {error && <p className="text-xs text-red-700">{error}</p>}
      </div>
    </Panel>
  );
}

export default function MyLeaguePage() {
  const { me, reload } = useMeContext();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (!me) return <Loading what="your league" />;
  if (!me.signedIn) return <Gate needs="signin" />;

  const profile = me.profile;
  const disconnect = async () => {
    await post('DELETE');
    setConfirming(false);
    await reload();
  };

  if (!profile || editing) {
    return <LeagueForm hasLogin={profile?.hasLogin} onCancel={profile ? () => setEditing(false) : undefined} onSaved={async () => { setEditing(false); await reload(); }} />;
  }

  return (
    <div className="space-y-5">
      <Panel
        title={profile.teamName ?? `Team ${profile.teamId}`}
        sub={`${profile.leagueName || `League ${profile.leagueId}`} · ${profile.hasLogin ? 'private league, ESPN login saved encrypted' : 'read without an ESPN login'}`}
        right={
          confirming ? (
            <span className="flex items-center gap-2">
              Remove this league{profile.hasLogin ? ' and your saved ESPN login' : ''}?
              <button className="btn-accent" onClick={disconnect}>Disconnect</button>
              <button className="btn-ghost" onClick={() => setConfirming(false)}>Keep</button>
            </span>
          ) : (
            <span className="flex gap-2">
              <button className="btn-ghost" onClick={() => setEditing(true)}>Change league</button>
              <button className="btn-ghost" onClick={() => setConfirming(true)}>Disconnect</button>
            </span>
          )
        }
      >
        <p className="text-sm text-muted">Signed in as {me.email}. We refresh your league twice a day; hit Refresh on This week for the latest.</p>
      </Panel>
      {me.pro ? <CorePicker key={`${profile.leagueId}-${profile.teamId}`} core={profile.core} /> : <Gate needs="pro" />}
      <Alerts profile={profile} me={me} reload={reload} />
    </div>
  );
}
