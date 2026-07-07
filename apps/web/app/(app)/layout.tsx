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

const NAV: Array<{ href: string; label: string; Icon: LucideIcon; tour?: string }> = [
  { href: '/dashboard', label: 'Dash', Icon: LayoutDashboard, tour: 'nav-dashboard' },
  { href: '/watchlist', label: 'Watch', Icon: Star, tour: 'nav-watchlist' },
  { href: '/charts', label: 'Charts', Icon: BarChart3 },
  { href: '/history', label: 'History', Icon: History, tour: 'nav-history' },
  { href: '/account', label: 'Account', Icon: UserCircle, tour: 'nav-account' },
  { href: '/settings', label: 'Config', Icon: Settings, tour: 'nav-settings' },
];

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
      <span className="font-mono text-[8px] font-bold uppercase tracking-wider opacity-70 group-hover:opacity-100">
        {label}
      </span>
      {active && (
        <span className="absolute -right-0.5 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-teal shadow-[var(--shadow-teal-glow)]" />
      )}
    </Link>
  );
}

function StatusBar({ scanActive }: { scanActive: boolean }) {
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
        <span>LATENCY 12ms</span>
        <span>UPTIME 99.2%</span>
      </div>
      <div className="flex items-center gap-4">
        <span>HYPERFORGE v0.1.1</span>
        <span className="text-teal">{clock} UTC-4</span>
      </div>
    </footer>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const { entitlements, openUpgradeModal } = useSubscription();

  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? '';
  const role = (clerkUser?.publicMetadata?.role as string | undefined) ?? 'USER';
  const isAdmin = role === 'ADMIN' || role === 'DEVELOPER';
  const allNav = isAdmin ? [...NAV, ADMIN_NAV] : NAV;
  const showUpgrade = entitlements?.effectiveTier === 'free';

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
        <AmbientFx ghost />
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>

        <div className="relative flex min-h-dvh flex-col">
          {/* ── Top HUD ── */}
          <header className="cmd-hud fixed inset-x-0 top-0 z-40 flex items-center gap-3 px-3 md:px-4">
            <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
              <motion.img
                src="/icon.png"
                alt=""
                width={28}
                height={28}
                className="rounded-md shadow-[var(--shadow-teal-glow)]"
                animate={reduce ? undefined : { rotate: [0, 1, -1, 0] }}
                transition={{ duration: 6, repeat: Infinity }}
              />
              <div className="hidden sm:block">
                <p className="font-display text-sm font-bold uppercase tracking-widest text-ink">
                  Autotrade
                </p>
                <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-teal">
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
                  className="btn-forge-primary hidden px-3 py-1.5 sm:flex"
                  onClick={() => openUpgradeModal('Upgrade to unlock live trading')}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Upgrade
                </button>
              )}
              <div className="forge-inset flex items-center gap-2 px-2 py-1">
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
                  <p className="max-w-[120px] truncate font-mono text-[10px] text-ink">{email}</p>
                  <p
                    className="font-mono text-[9px] font-bold uppercase"
                    style={{ color: tierDisplayColor(entitlements?.effectiveTier ?? 'free') }}
                  >
                    {tierDisplayLabel(entitlements?.effectiveTier ?? 'free')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  aria-label="Sign out"
                  className="forge-button p-1.5 text-ink-muted hover:text-red"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </header>

          <div className="flex flex-1 pt-[var(--hud-h)]">
            {/* ── Icon rail ── */}
            <aside className="cmd-rail fixed bottom-[var(--mobile-nav-h)] left-0 top-[var(--hud-h)] z-30 hidden flex-col items-center gap-1 py-3 md:flex">
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
              className="relative min-w-0 flex-1 md:ml-[var(--rail-w)] md:pb-[var(--status-h)]"
            >
              <div className="md:hidden">
                <DataTicker />
              </div>
              <ErrorBoundary>{children}</ErrorBoundary>
            </main>
          </div>

          <StatusBar scanActive />

          {/* ── Mobile deck ── */}
          <nav
            className="fixed inset-x-0 bottom-0 z-40 flex h-[var(--mobile-nav-h)] items-stretch justify-around border-t border-border bg-surface/95 px-1 backdrop-blur-xl md:hidden"
            aria-label="Mobile"
          >
            {allNav.slice(0, 5).map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-0.5 font-mono text-[8px] font-bold uppercase',
                  pathname === n.href ? 'text-teal' : 'text-ink-muted',
                )}
              >
                <n.Icon className="h-5 w-5" />
                {n.label}
              </Link>
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
