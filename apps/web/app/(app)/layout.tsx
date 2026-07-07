'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useUser, useClerk } from '@clerk/nextjs';
import * as Sentry from '@sentry/nextjs';
import { AuthProvider } from '@/src/state/auth';
import { SubscriptionProvider } from '@/src/components/subscription/SubscriptionProvider';
import { ConstellationBg } from '@/src/components/ConstellationBg';
import { DataTicker } from '@/src/components/DataTicker';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';
import { OnboardingExperience } from '@/src/components/onboarding/OnboardingExperience';
import { ProductTour } from '@/src/components/onboarding/ProductTour';
import {
  LayoutDashboard,
  Star,
  BarChart3,
  History,
  Settings,
  Shield,
  Sparkles,
  UserCircle,
  type LucideIcon,
} from 'lucide-react';
import { tierDisplayColor, tierDisplayLabel } from '@autotrade/shared';
import { useSubscription } from '@/src/components/subscription/SubscriptionProvider';

const NAV: Array<{ href: string; label: string; Icon: LucideIcon; tour?: string }> = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard, tour: 'nav-dashboard' },
  { href: '/watchlist', label: 'Watchlist', Icon: Star, tour: 'nav-watchlist' },
  { href: '/charts', label: 'Charts', Icon: BarChart3 },
  { href: '/history', label: 'Trade History', Icon: History, tour: 'nav-history' },
  { href: '/account', label: 'Account', Icon: UserCircle, tour: 'nav-account' },
  { href: '/settings', label: 'Settings', Icon: Settings, tour: 'nav-settings' },
];

const ADMIN_NAV: { href: string; label: string; Icon: LucideIcon; tour?: string } = {
  href: '/admin',
  label: 'Admin',
  Icon: Shield,
};

function SidebarFooter() {
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const { entitlements, openUpgradeModal } = useSubscription();

  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? '';
  const role = (clerkUser?.publicMetadata?.role as string | undefined) ?? 'USER';
  const showUpgrade = entitlements?.effectiveTier === 'free';

  return (
    <div className="sidebar-footer">
      {showUpgrade && (
        <button
          type="button"
          className="btn-upgrade-now"
          onClick={() => openUpgradeModal('Upgrade to unlock live trading and faster scans')}
        >
          <Sparkles size={14} aria-hidden />
          Upgrade now
        </button>
      )}
      <div className="user-chip">
        <div className="avatar">{email[0]?.toUpperCase()}</div>
        <div className="user-meta">
          <div className="user-email">{email}</div>
          <div
            className="user-role"
            style={{ color: tierDisplayColor(entitlements?.effectiveTier ?? 'free') }}
          >
            {tierDisplayLabel(entitlements?.effectiveTier ?? 'free')}
          </div>
        </div>
      </div>
      <button className="btn-ghost" onClick={() => void signOut()}>Sign out</button>
    </div>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { user: clerkUser } = useUser();
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
      <SubscriptionProvider>
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
                  <span className="nav-icon" aria-hidden="true"><n.Icon /></span>
                  {n.label}
                </a>
              ))}
            </nav>
            <SidebarFooter />
          </aside>
          <main className="content" id="main-content">
            <DataTicker />
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
          <nav className="mobile-nav">
            {allNav.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className={`mob-nav-item${pathname === n.href ? ' active' : ''}`}
                aria-current={pathname === n.href ? 'page' : undefined}
                {...(n.tour ? { 'data-tour': n.tour } : {})}
              >
                <span className="mob-nav-icon" aria-hidden="true"><n.Icon /></span>
                {n.label}
              </a>
            ))}
          </nav>
        </div>
      </SubscriptionProvider>
    </AuthProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded || !isSignedIn) return null;

  return <AppShell>{children}</AppShell>;
}
