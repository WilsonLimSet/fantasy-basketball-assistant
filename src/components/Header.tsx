'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoMark } from './Logo';

export function Header() {
  const pathname = usePathname();

  return (
    <header className="header">
      <div className="header-content">
        <Link href="/inseason" className="logo">
          <LogoMark size={22} />
          <span>CourtVision <span style={{ color: 'var(--muted)', fontWeight: 400 }}>In-Season</span></span>
        </Link>
        <nav className="nav">
          <Link
            href="/inseason"
            className={pathname === '/inseason' ? 'active' : ''}
          >
            Dashboard
          </Link>
          <Link
            href="/inseason/waivers"
            className={pathname === '/inseason/waivers' ? 'active' : ''}
          >
            Waivers
          </Link>
          <Link
            href="/inseason/weekly"
            className={pathname === '/inseason/weekly' ? 'active' : ''}
          >
            Weekly Plan
          </Link>
          <Link
            href="/inseason/connect"
            className={pathname === '/inseason/connect' ? 'active' : ''}
          >
            Connect
          </Link>
          <Link href="/">Draft Kit</Link>
        </nav>
      </div>
    </header>
  );
}
