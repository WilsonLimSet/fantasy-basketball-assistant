'use client';

import Link from 'next/link';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

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

const MeContext = createContext<{ me: Me | null; reload: () => Promise<void> }>({ me: null, reload: async () => {} });

/** The signed-in user and their connected league, loaded once for every in-season page. */
export function MeProvider({ children }: { children: React.ReactNode }) {
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
  return <MeContext.Provider value={{ me, reload }}>{children}</MeContext.Provider>;
}

export const useMeContext = () => useContext(MeContext);

// ============ Shared bits, styled like the draft kit ============

export function Panel({ title, sub, right, children, className = '' }: {
  title?: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`rounded-xl border border-line bg-panel shadow-[0_1px_2px_rgba(25,25,25,0.04)] ${className}`}>
      {(title || right) && (
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-sm font-medium tracking-tight">{title}</h2>
            {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
          </div>
          {right && <div className="text-xs text-muted">{right}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Loading({ what }: { what: string }) {
  return <div className="py-20 text-center text-muted">Loading {what}…</div>;
}

export function ErrorBox({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-700">{children}</div>;
}

export function formatAge(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

/** What to show instead of the tools: sign in, upgrade, or connect a league. */
export function Gate({ needs }: { needs: 'signin' | 'pro' | 'connect' }) {
  const { me } = useMeContext();
  const copy = {
    signin: {
      title: 'Win the week with two extra games',
      body: 'Connect your ESPN league and get the add/drops that put the most games in your lineup, every morning.',
    },
    pro: {
      title: 'In-season is part of Pro',
      body: 'Daily add/drops built on usable games, your matchup’s game counts, watchlist alerts and a morning email.',
    },
    connect: {
      title: 'Connect your ESPN league',
      body: 'Paste your ESPN team link and pick your team. It takes a minute.',
    },
  }[needs];
  return (
    <section className="rounded-xl border border-line bg-panel px-6 py-10 shadow-[0_1px_2px_rgba(25,25,25,0.04)] sm:px-10">
      <h1 className="text-2xl font-medium leading-tight tracking-[-0.03em] sm:text-3xl">{copy.title}</h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">{copy.body}</p>
      <div className="mt-5">
        {needs === 'signin' && (
          <Link href="/login?next=/inseason/connect" className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white hover:bg-ink/85">
            Sign in to start
          </Link>
        )}
        {needs === 'connect' && (
          <Link href="/inseason/connect" className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white hover:bg-ink/85">
            Connect league
          </Link>
        )}
        {needs === 'pro' &&
          (me?.paymentLink ? (
            <a href={me.paymentLink} className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white hover:bg-ink/85">
              Get the {me.priceLabel}
            </a>
          ) : (
            <span className="text-sm text-muted">Payments aren’t switched on yet.</span>
          ))}
      </div>
    </section>
  );
}
