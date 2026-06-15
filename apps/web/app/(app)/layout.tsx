'use client';
import { useState, useEffect } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import * as Sentry from '@sentry/nextjs';
import { AuthProvider } from '@/src/state/auth';
import { ConstellationBg } from '@/src/components/ConstellationBg';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';

type View = 'dashboard' | 'watchlist' | 'charts' | 'history' | 'settings' | 'admin';

const NAV: Array<{ id: View; label: string; icon: string; adminOnly?: boolean }> = [
  { id: 'dashboard', label: 'Dashboard', icon: '▦' },
  { id: 'watchlist', label: 'Watchlist', icon: '★' },
  { id: 'charts', label: 'Charts', icon: '◰' },
  { id: 'history', label: 'Trade History', icon: '≡' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
  { id: 'admin', label: 'Admin', icon: '⛨', adminOnly: true },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user: clerkUser, isLoaded } = useUser();
  const { signOut } = useClerk();

  if (!isLoaded) return null;
  if (!clerkUser) return null;

  const email = clerkUser.primaryEmailAddress?.emailAddress ?? '';
  const role = (clerkUser.publicMetadata?.role as string | undefined) ?? 'USER';

  useEffect(() => {
    Sentry.setUser({ id: clerkUser.id, email });
    return () => Sentry.setUser(null);
  }, [clerkUser.id, email]);

  return (
    <AuthProvider>
      <ConstellationBg dim />
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">AT</div>
            <span className="brand-name">Autotrade</span>
          </div>
          <nav>
            {NAV.filter((n) => !n.adminOnly || role === 'ADMIN' || role === 'DEVELOPER').map((n) => (
              <a
                key={n.id}
                href={`/${n.id}`}
                className={`nav-item`}
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
          {NAV.filter((n) => !n.adminOnly || role === 'ADMIN' || role === 'DEVELOPER').map((n) => (
            <a key={n.id} href={`/${n.id}`} className="mob-nav-item">
              <span className="mob-nav-icon">{n.icon}</span>
              {n.label}
            </a>
          ))}
        </nav>
      </div>
    </AuthProvider>
  );
}
