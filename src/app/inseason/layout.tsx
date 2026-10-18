import type { Metadata } from 'next';
import { InseasonShell } from './Shell';
import { seasonMode } from '@/lib/season';

export const metadata: Metadata = {
  title: 'In-season · Takeover Fantasy',
  description: 'Add/drops built on usable games, matchup game counts and watchlist alerts for your ESPN league.',
};

// Re-render hourly so season mode switches on by itself.
export const revalidate = 3600;

export default function InSeasonLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <InseasonShell season={seasonMode()}>{children}</InseasonShell>;
}
