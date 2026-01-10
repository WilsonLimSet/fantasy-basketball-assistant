'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Header() {
  const pathname = usePathname();

  return (
    <header className="header">
      <div className="header-content">
        <Link href="/" className="logo">
          <span>🏀</span>
          <span>Adam</span>
        </Link>
        <nav className="nav">
          <Link
            href="/"
            className={pathname === '/' ? 'active' : ''}
          >
            Dashboard
          </Link>
          <Link
            href="/waivers"
            className={pathname === '/waivers' ? 'active' : ''}
          >
            Waivers
          </Link>
          <Link
            href="/weekly"
            className={pathname === '/weekly' ? 'active' : ''}
          >
            Weekly Plan
          </Link>
          <Link
            href="/connect"
            className={pathname === '/connect' ? 'active' : ''}
          >
            Connect
          </Link>
        </nav>
      </div>
    </header>
  );
}
