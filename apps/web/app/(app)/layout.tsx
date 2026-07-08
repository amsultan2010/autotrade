'use client';

import { useEffect, useState } from 'react';
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
  Radio,
  type LucideIcon,
} from 'lucide-react';
import { tierDisplayColor, tierDisplayLabel } from '@autotrade/shared';
import { useSubscription } from '@/src/components/subscription/SubscriptionProvider';
import { useBotStatus, useUserProfile } from '@/src/hooks/data';
import { AppLoadingShell } from '@/src/components/AppLoadingShell';
import { MobileHudStatus } from '@/src/components/layout/MobileHudStatus';

const NAV: Array<{ href: string; label: string; Icon: LucideIcon; tour?: string }> = [
  { href: '/dashboard', label: 'Dash', Icon: LayoutDashboard, tour: 'nav-dashboard' },
  { href: '/watchlist', label: 'Watch', Icon: Star, tour: 'nav-watchlist' },
  { href: '/charts', label: 'Charts', Icon: BarChart3 },
  { href: '/history', label: 'History', Icon: History, tour: 'nav-history' },
  { href: '/account', label: 'Account', Icon: UserCircle, tour: 'nav-account' },
  { href: '/settings', label: 'Config', Icon: Settings, tour: 'nav-settings' },
];

const MOBILE_NAV = [
  NAV[0], // Dash
  NAV[1], // Watch
  NAV[2], // Charts
  NAV[3], // History
  NAV[5], // Config
] as const;

const ADMIN_NAV: { href: string; label: string; Icon: LucideIcon; tour?: string } = {
  href: '/admin',
  label: 'Admin',
  Icon: Shield,
};

function RailLink({
  href,
  label,
  Icon,
  active,
  tour,
}: {
  href: string;
  label: string;
  Icon: LucideIcon;
  active: boolean;
  tour?: string;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-current={active ? 'page' : undefined}
      {...(tour ? { 'data-tour': tour } : {})}
      className={cn(
        'group relative flex flex-col items-center gap-1 rounded-md px-2 py-2.5 transition-all',
        active ? 'nav-item-premium active text-teal' : 'text-ink-muted hover:text-teal',
      )}
    >
      <Icon className="h-5 w-5" aria-hidden />
      <span className="font-mono text-[10px] font-bold uppercase tracking-wider opacity-80 group-hover:opacity-100">
        {label}
      </span>
      {active && (
        <span className="absolute -right-0.5 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-teal shadow-[var(--shadow-teal-glow)]" />
      )}
    </Link>
  );
}

function StatusBar() {
  const { data: botStatus } = useBotStatus();
  const scanActive = botStatus?.running ?? false;
  const mode = botStatus?.mode ?? '…';

  const [clock, setClock] = useState('');
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-US', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <footer className="cmd-status fixed inset-x-0 bottom-0 z-30 hidden items-center justify-between gap-4 px-4 text-ink-muted md:flex">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span className={cn('forge-led', !scanActive && 'opacity-40')} />
          SCAN {scanActive ? 'ACTIVE' : 'IDLE'}
        </span>
        <span>MODE {mode}</span>
        {botStatus?.scanIntervalSeconds != null && (
          <span>INTERVAL {botStatus.scanIntervalSeconds}s</span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span>HYPERFORGE v0.1.1</span>
        <span className="text-teal">{clock}</span>
      </div>
    </footer>
  );
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const { entitlements, openUpgradeModal } = useSubscription();
  const { data: profile } = useUserProfile();

  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? '';
  // Supabase role is authoritative for admin APIs; do not trust Clerk publicMetadata alone.
  const role = profile?.role ?? 'USER';
  const isAdmin = role === 'ADMIN' || role === 'DEVELOPER';
  const allNav = isAdmin ? [...NAV, ADMIN_NAV] : NAV;
  const showUpgrade = entitlements?.effectiveTier === 'free';

  useEffect(() => {
    if (!clerkUser) return;
    Sentry.setUser({ id: clerkUser.id, email });
    return () => Sentry.setUser(null);
  }, [clerkUser?.id, email]);

  return (
    <>
        <OnboardingExperience />
        <ProductTour />
        <AmbientFx variant="app" />
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>

        <div className="relative flex min-h-dvh flex-col">
          {/* ── Top HUD ── */}
          <header className="cmd-hud fixed inset-x-0 top-0 z-40 flex items-center gap-2 px-3 md:gap-3 md:px-4">
            <Link href="/dashboard" className="touch-target flex min-w-0 items-center gap-2">
              <motion.img
                src="/icon.png"
                alt=""
                width={28}
                height={28}
                className="rounded-md shadow-[var(--shadow-teal-glow)]"
                animate={reduce ? undefined : { rotate: [0, 1, -1, 0] }}
                transition={{ duration: 6, repeat: Infinity }}
              />
              <div className="min-w-0 sm:block">
                <p className="truncate font-display text-sm font-bold uppercase tracking-widest text-ink">
                  Autotrade
                </p>
                <p className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-teal sm:block">
                  HyperForge Console
                </p>
              </div>
            </Link>

            <div className="hidden flex-1 overflow-hidden md:block">
              <DataTicker compact />
            </div>

            <div className="ml-auto flex items-center gap-2">
              <span className="forge-inset hidden items-center gap-2 px-2.5 py-1 font-mono text-[10px] text-teal lg:flex">
                <Radio className="h-3 w-3" />
                LIVE
              </span>
              {showUpgrade && (
                <button
                  type="button"
                  className="btn-forge-primary touch-target hidden px-3 py-1.5 sm:flex"
                  onClick={() => openUpgradeModal('Upgrade to unlock live trading')}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Upgrade</span>
                </button>
              )}
              <div className="forge-inset flex items-center gap-1.5 px-1.5 py-1 md:gap-2 md:px-2">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded font-mono text-[10px] font-bold"
                  style={{
                    background: `color-mix(in oklab, ${tierDisplayColor(entitlements?.effectiveTier ?? 'free')} 18%, transparent)`,
                    color: tierDisplayColor(entitlements?.effectiveTier ?? 'free'),
                  }}
                >
                  {email[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="hidden min-w-0 md:block">
                  <p className="max-w-[120px] truncate text-xs text-ink">{email}</p>
                  <p
                    className="text-[11px] font-bold uppercase"
                    style={{ color: tierDisplayColor(entitlements?.effectiveTier ?? 'free') }}
                  >
                    {tierDisplayLabel(entitlements?.effectiveTier ?? 'free')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  aria-label="Sign out"
                  className="forge-button touch-target p-2 text-ink-muted hover:text-red md:p-1.5"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </header>

          <div className="flex flex-1 pt-[calc(var(--hud-h)+var(--safe-top))]">
            {/* ── Icon rail ── */}
            <aside className="cmd-rail fixed bottom-[var(--mobile-nav-h)] left-0 top-[calc(var(--hud-h)+var(--safe-top))] z-30 hidden flex-col items-center gap-1 py-3 md:flex">
              <nav className="flex flex-1 flex-col gap-0.5 px-1.5" aria-label="Main">
                {allNav.map((n) => (
                  <RailLink
                    key={n.href}
                    href={n.href}
                    label={n.label}
                    Icon={n.Icon}
                    active={pathname === n.href}
                    tour={n.tour}
                  />
                ))}
              </nav>
            </aside>

            {/* ── Main viewport ── */}
            <main
              id="main-content"
              className="relative min-w-0 flex-1 overflow-x-clip md:ml-[var(--rail-w)] md:pb-[var(--status-h)]"
            >
              <MobileHudStatus />
              <div className="md:hidden">
                <DataTicker compact />
              </div>
              <ErrorBoundary>{children}</ErrorBoundary>
            </main>
          </div>

          <StatusBar />

          {/* ── Mobile deck ── */}
          <nav
            className="fixed inset-x-0 bottom-0 z-40 flex min-h-[var(--mobile-nav-h)] items-stretch justify-around border-t border-border bg-surface/95 px-0.5 pt-1 backdrop-blur-xl md:hidden"
            style={{ paddingBottom: 'max(4px, var(--safe-bottom))' }}
            aria-label="Mobile"
          >
            {MOBILE_NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={pathname === n.href ? 'page' : undefined}
                {...(n.tour ? { 'data-tour': n.tour } : {})}
                className={cn(
                  'touch-target flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[9px] font-bold uppercase tracking-wide sm:text-[10px]',
                  pathname === n.href ? 'text-teal' : 'text-ink-muted',
                )}
              >
                <n.Icon className="h-5 w-5 shrink-0" aria-hidden />
                <span className="truncate">{n.label}</span>
              </Link>
            ))}
          </nav>
        </div>
    </>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <AppShellInner>{children}</AppShellInner>
      </SubscriptionProvider>
    </AuthProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return <AppLoadingShell />;
  if (!isSignedIn) return null;
  return <AppShell>{children}</AppShell>;
}
