'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser, useClerk } from '@clerk/nextjs';
import * as Sentry from '@sentry/nextjs';
import { motion, useReducedMotion } from 'framer-motion';
import { AuthProvider } from '@/src/state/auth';
import { SubscriptionProvider } from '@/src/components/subscription/SubscriptionProvider';
import { AmbientFx } from '@/src/components/AmbientFx';
import { DataTicker } from '@/src/components/DataTicker';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';
import { OnboardingExperience } from '@/src/components/onboarding/OnboardingExperience';
import { ProductTour } from '@/src/components/onboarding/ProductTour';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Star,
  BarChart3,
  History,
  Settings,
  Shield,
  Sparkles,
  UserCircle,
  LogOut,
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

function NavLink({
  href,
  label,
  Icon,
  active,
  tour,
  compact,
}: {
  href: string;
  label: string;
  Icon: LucideIcon;
  active: boolean;
  tour?: string;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      {...(tour ? { 'data-tour': tour } : {})}
      className={cn(
        'nav-item-premium flex items-center gap-3 px-3 py-2.5 text-sm font-semibold',
        compact && 'flex-col gap-1 px-1 py-2 text-[9px]',
        active
          ? 'active text-gold'
          : 'text-ink-secondary hover:bg-surface-raised hover:text-ink',
      )}
    >
      <Icon className={cn('shrink-0', compact ? 'h-5 w-5' : 'h-[18px] w-[18px]')} aria-hidden />
      <span className={cn(compact && 'leading-none')}>{label}</span>
    </Link>
  );
}

function SidebarFooter() {
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const { entitlements, openUpgradeModal } = useSubscription();
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? '';
  const showUpgrade = entitlements?.effectiveTier === 'free';

  return (
    <div className="mt-auto space-y-3 border-t border-border p-4">
      {showUpgrade && (
        <button
          type="button"
          className="btn-gold flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm"
          onClick={() => openUpgradeModal('Upgrade to unlock live trading and faster scans')}
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          Upgrade now
        </button>
      )}
      <div className="material-inset flex items-center gap-3 p-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
          style={{
            background: `color-mix(in oklab, ${tierDisplayColor(entitlements?.effectiveTier ?? 'free')} 20%, transparent)`,
            color: tierDisplayColor(entitlements?.effectiveTier ?? 'free'),
            boxShadow: `0 0 16px color-mix(in oklab, ${tierDisplayColor(entitlements?.effectiveTier ?? 'free')} 35%, transparent)`,
          }}
        >
          {email[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{email}</p>
          <p
            className="text-xs font-bold uppercase tracking-wide"
            style={{ color: tierDisplayColor(entitlements?.effectiveTier ?? 'free') }}
          >
            {tierDisplayLabel(entitlements?.effectiveTier ?? 'free')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          aria-label="Sign out"
          className="material-button p-2 text-ink-muted hover:text-ink"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { user: clerkUser } = useUser();
  const pathname = usePathname();
  const reduce = useReducedMotion();

  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? '';
  const role = (clerkUser?.publicMetadata?.role as string | undefined) ?? 'USER';
  const isAdmin = role === 'ADMIN' || role === 'DEVELOPER';
  const allNav = isAdmin ? [...NAV, ADMIN_NAV] : NAV;

  useEffect(() => {
    if (!clerkUser) return;
    Sentry.setUser({ id: clerkUser.id, email });
    return () => Sentry.setUser(null);
  }, [clerkUser?.id, email]);

  return (
    <AuthProvider>
      <SubscriptionProvider>
        <OnboardingExperience />
        <ProductTour />
        <AmbientFx dim />
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <div className="relative flex min-h-dvh">
          <aside className="app-sidebar hidden w-[var(--sidebar-w)] shrink-0 flex-col md:flex">
            <div className="flex h-[72px] items-center gap-3 border-b border-border px-5">
              <motion.img
                src="/icon.png"
                alt=""
                width={36}
                height={36}
                className="rounded-xl shadow-[var(--shadow-gold-glow)]"
                animate={reduce ? undefined : { rotate: [0, 2, -2, 0] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div>
                <span className="font-display text-lg font-extrabold tracking-tight text-ink">
                  Autotrade
                </span>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-gold">Trading Console</p>
              </div>
            </div>
            <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Main">
              {allNav.map((n) => (
                <NavLink
                  key={n.href}
                  href={n.href}
                  label={n.label}
                  Icon={n.Icon}
                  active={pathname === n.href}
                  tour={n.tour}
                />
              ))}
            </nav>
            <SidebarFooter />
          </aside>

          <div className="relative flex min-w-0 flex-1 flex-col">
            <header className="flex h-14 items-center justify-between border-b border-border bg-surface/80 px-4 backdrop-blur-md md:hidden">
              <Link href="/dashboard" className="flex items-center gap-2">
                <img src="/icon.png" alt="" width={28} height={28} className="rounded-lg" />
                <span className="font-display font-bold">Autotrade</span>
              </Link>
            </header>

            <main
              id="main-content"
              className="relative flex-1 overflow-y-auto pb-[calc(var(--mobile-nav-h)+16px)] md:pb-0"
            >
              <DataTicker />
              <ErrorBoundary>{children}</ErrorBoundary>
            </main>

            <nav
              className="fixed inset-x-0 bottom-0 z-20 flex h-[var(--mobile-nav-h)] items-stretch justify-around border-t border-border bg-surface/95 px-1 backdrop-blur-xl md:hidden"
              aria-label="Mobile"
            >
              {allNav.slice(0, 5).map((n) => (
                <NavLink
                  key={n.href}
                  href={n.href}
                  label={n.label.split(' ')[0]!}
                  Icon={n.Icon}
                  active={pathname === n.href}
                  tour={n.tour}
                  compact
                />
              ))}
            </nav>
          </div>
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
