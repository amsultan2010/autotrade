'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useUser, useClerk } from '@clerk/nextjs';
import * as Sentry from '@sentry/nextjs';
import { AuthProvider } from '@/src/state/auth';
import { ConstellationBg } from '@/src/components/ConstellationBg';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';

const NAV = [
  { href: '/dashboard',  label: 'Dashboard',    icon: '▦' },
  { href: '/watchlist',  label: 'Watchlist',     icon: '★' },
  { href: '/charts',     label: 'Charts',        icon: '◰' },
  { href: '/history',    label: 'Trade History', icon: '≡' },
  { href: '/settings',   label: 'Settings',      icon: '⚙' },
] as const;

const ADMIN_NAV = { href: '/admin', label: 'Admin', icon: '⛨' } as const;

// Inner layout — only rendered when Clerk is loaded and user exists.
// Keeps all hooks at the top level unconditionally.
function AppShell({ children }: { children: React.ReactNode }) {
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const pathname = usePathname();

  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? '';
  const role = (clerkUser?.publicMetadata?.role as string | undefined) ?? 'USER';
  const isAdmin = role === 'ADMIN' || role === 'DEVELOPER';

  useEffect(() => {
    if (!clerkUser) return;
    Sentry.setUser({ id: clerkUser.id, email });
    return () => Sentry.setUser(null);
  }, [clerkUser?.id, email]);

  const allNav = isAdmin ? [...NAV, ADMIN_NAV] : NAV;

  return (
    <AuthProvider>
      <ConstellationBg dim />
      <div className="app-shell">
        <aside className="sidebar">
          <div className="nav-logo">
            <img src="/icon.svg" alt="Autotrade" width={30} height={30} style={{ borderRadius: 6, flexShrink: 0 }} />
            <span className="nav-logo-text">Autotrade</span>
          </div>
          <nav>
            {allNav.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className={`nav-item${pathname === n.href ? ' active' : ''}`}
              >
                <span className="nav-icon">{n.icon}</span>
                {n.label}
              </a>
            ))}
          </nav>
          <div className="sidebar-footer">
            <div className="user-chip">
              <div className="avatar">{email[0]?.toUpperCase()}</div>
              <div className="user-meta">
                <div className="user-email">{email}</div>
                <div className="user-role">{role}</div>
              </div>
            </div>
            <button className="btn-ghost" onClick={() => void signOut()}>Sign out</button>
          </div>
        </aside>
        <main className="content">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
        <nav className="mobile-nav">
          {allNav.map((n) => (
            <a key={n.href} href={n.href} className={`mob-nav-item${pathname === n.href ? ' active' : ''}`}>
              <span className="mob-nav-icon">{n.icon}</span>
              {n.label}
            </a>
          ))}
        </nav>
      </div>
    </AuthProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded || !isSignedIn) return null;

  return <AppShell>{children}</AppShell>;
}
