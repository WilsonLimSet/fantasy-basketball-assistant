'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Header() {
  const pathname = usePathname();

  return (
    <header className="header">
      <div className="header-content">
        <Link href="/inseason" className="logo">
          <span>🏀</span>
          <span>Adam</span>
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
