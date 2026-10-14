'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

export interface MeProfile {
  leagueId: string;
  seasonId: number;
  teamId: number;
  teamName?: string;
  leagueName?: string;
  core: number[];
  alerts: { email: boolean };
  hasLogin: boolean;
  lastRefreshAt?: number;
}

export interface Me {
  signedIn: boolean;
  email?: string;
  pro?: boolean;
  profile?: MeProfile | null;
  emailAlerts?: boolean;
  paymentLink?: string | null;
  priceLabel?: string;
}

export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const reload = useCallback(async () => {
    try {
      const r = await fetch('/api/inseason/me', { cache: 'no-store' });
      setMe(await r.json());
    } catch {
      setMe({ signedIn: false });
    }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { me, reload };
}

/** What to show instead of the tools: sign in, upgrade, or connect a league. */
export function Gate({ needs, me }: { needs: 'signin' | 'pro' | 'connect'; me?: Me | null }) {
  if (needs === 'signin') {
    return (
      <div className="card">
        <h2 className="card-title" style={{ marginBottom: '0.5rem' }}>Sign in to manage your team</h2>
        <p style={{ color: 'var(--muted)', marginBottom: '1rem' }}>
          Connect your ESPN league and get the add/drops that win you the most games each week.
        </p>
        <a className="btn btn-primary" href="/login?next=/inseason/connect">Sign in</a>
      </div>
    );
  }
  if (needs === 'pro') {
    return (
      <div className="card">
        <h2 className="card-title" style={{ marginBottom: '0.5rem' }}>In-season tools are part of Pro</h2>
        <p style={{ color: 'var(--muted)', marginBottom: '1rem' }}>
          Daily add/drop picks built on usable games, your matchup&apos;s game counts, watchlist alerts and a morning email.
        </p>
        {me?.paymentLink ? (
          <a className="btn btn-primary" href={me.paymentLink}>Get the {me.priceLabel}</a>
        ) : (
          <span style={{ color: 'var(--muted)' }}>Payments aren&apos;t switched on yet.</span>
        )}
      </div>
    );
  }
  return (
    <div className="card">
      <h2 className="card-title" style={{ marginBottom: '0.5rem' }}>Connect your ESPN league</h2>
      <p style={{ color: 'var(--muted)', marginBottom: '1rem' }}>Paste your ESPN team link and pick your team. Takes a minute.</p>
      <Link className="btn btn-primary" href="/inseason/connect">Connect league</Link>
    </div>
  );
}
