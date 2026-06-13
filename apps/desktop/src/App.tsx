import { useState } from 'react';
import { useUser, useClerk } from '@clerk/react';
import { useAuth } from './state/auth';
import { ConstellationBg } from './components/ConstellationBg';
import { ScanlineOverlay } from './components/ScanlineOverlay';
import { Login } from './pages/Login';
import { Paywall } from './pages/Paywall';
import { Dashboard } from './pages/Dashboard';
import { Watchlist } from './pages/Watchlist';
import { TradeHistory } from './pages/TradeHistory';
import { Settings } from './pages/Settings';
import { Admin } from './pages/Admin';
import { Charts } from './pages/Charts';

type View = 'dashboard' | 'watchlist' | 'charts' | 'history' | 'settings' | 'admin';

const NAV: Array<{ id: View; label: string; icon: string; adminOnly?: boolean }> = [
  { id: 'dashboard', label: 'Dashboard', icon: '▦' },
  { id: 'watchlist', label: 'Watchlist', icon: '★' },
  { id: 'charts', label: 'Charts', icon: '◰' },
  { id: 'history', label: 'Trade History', icon: '≡' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
  { id: 'admin', label: 'Admin', icon: '⛨', adminOnly: true },
];

export function App() {
  const { user: clerkUser, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { subscription, loading } = useAuth();
  const [view, setView] = useState<View>('dashboard');

  if (loading || !isLoaded) {
    return (
      <>
        <ConstellationBg />
        <ScanlineOverlay />
        <div className="splash">
          <div className="logo-lg">Autotrade</div>
          <div className="muted">Securing session…</div>
        </div>
      </>
    );
  }

  if (!clerkUser) return <><ConstellationBg /><Login /></>;

  if (subscription && !subscription.entitled) return <><ConstellationBg /><Paywall /></>;

  const email = clerkUser.primaryEmailAddress?.emailAddress ?? '';
  // Role stored in Clerk public metadata; falls back to USER.
  const role = (clerkUser.publicMetadata?.role as string | undefined) ?? 'USER';

  return (
    <>
    <ConstellationBg />
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">AT</div>
          <span className="brand-name">Autotrade</span>
        </div>
        <nav>
          {NAV.filter((n) => !n.adminOnly || role === 'ADMIN' || role === 'DEVELOPER').map((n) => (
            <button
              key={n.id}
              className={`nav-item ${view === n.id ? 'active' : ''}`}
              onClick={() => setView(n.id)}
            >
              <span className="nav-icon">{n.icon}</span>
              {n.label}
            </button>
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
          <button className="btn-ghost" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="content">
        {view === 'dashboard' && <Dashboard />}
        {view === 'watchlist' && <Watchlist />}
        {view === 'charts' && <Charts />}
        {view === 'history' && <TradeHistory />}
        {view === 'settings' && <Settings />}
        {view === 'admin' && <Admin />}
      </main>

      <nav className="mobile-nav">
        {NAV.filter((n) => !n.adminOnly || role === 'ADMIN' || role === 'DEVELOPER').map((n) => (
          <button
            key={n.id}
            className={`mob-nav-item ${view === n.id ? 'active' : ''}`}
            onClick={() => setView(n.id)}
          >
            <span className="mob-nav-icon">{n.icon}</span>
            {n.label}
          </button>
        ))}
      </nav>
    </div>
    </>
  );
}
