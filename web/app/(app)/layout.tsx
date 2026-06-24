'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useUser, useClerk } from '@clerk/nextjs';
import * as Sentry from '@sentry/nextjs';
import { AuthProvider } from '@/src/state/auth';
import { ConstellationBg } from '@/src/components/ConstellationBg';
import { DataTicker } from '@/src/components/DataTicker';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';
import { OnboardingExperience } from '@/src/components/onboarding/OnboardingExperience';
import { ProductTour } from '@/src/components/onboarding/ProductTour';

const NAV = [
  { href: '/dashboard',  label: 'Dashboard',    icon: '▦', tour: 'nav-dashboard' },
  { href: '/watchlist',  label: 'Watchlist',     icon: '★', tour: 'nav-watchlist' },
  { href: '/charts',     label: 'Charts',        icon: '◰', tour: undefined },
  { href: '/history',    label: 'Trade History', icon: '≡', tour: 'nav-history' },
  { href: '/settings',   label: 'Settings',      icon: '⚙', tour: 'nav-settings' },
] as const;

const ADMIN_NAV = { href: '/admin', label: 'Admin', icon: '⛨', tour: undefined } as const;

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
      <OnboardingExperience />
      <ProductTour />
      <ConstellationBg dim />
      <a href="#main-content" className="skip-link">Skip to content</a>
      <div className="app-shell">
        <aside className="sidebar">
          <a href="/dashboard" className="brand">
            <img src="/icon.png" alt="" width={30} height={30} className="brand-icon" />
            <span className="brand-name">Autotrade</span>
          </a>
          <nav>
            {allNav.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className={`nav-item${pathname === n.href ? ' active' : ''}`}
                aria-current={pathname === n.href ? 'page' : undefined}
                {...(n.tour ? { 'data-tour': n.tour } : {})}
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
        <main className="content" id="main-content">
          <DataTicker />
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
        <nav className="mobile-nav">
          {allNav.map((n) => (
            <a key={n.href} href={n.href} className={`mob-nav-item${pathname === n.href ? ' active' : ''}`}
              aria-current={pathname === n.href ? 'page' : undefined}
              {...(n.tour ? { 'data-tour': n.tour } : {})}>
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
