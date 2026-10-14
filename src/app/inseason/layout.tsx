import type { Metadata } from 'next';
import { InseasonShell } from './Shell';

export const metadata: Metadata = {
  title: 'In-season · Takeover Fantasy',
  description: 'Add/drops built on usable games, matchup game counts and watchlist alerts for your ESPN league.',
};

export default function InSeasonLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <InseasonShell>{children}</InseasonShell>;
}
