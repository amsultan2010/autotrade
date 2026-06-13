import { useState } from 'react';
import { useAuth } from './state/auth';
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
  const { user, subscription, loading, logout } = useAuth();
  const [view, setView] = useState<View>('dashboard');

  if (loading) {
    return (
      <div className="splash">
        <div className="logo-lg">Quantara<span className="accent">.ai</span></div>
        <div className="muted">Securing session…</div>
      </div>
    );
  }

  // Not authenticated → login/register.
  if (!user) return <Login />;

  // Authenticated but not entitled → paywall (req #2: no active sub = blocked).
  if (subscription && !subscription.entitled) return <Paywall />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          Quantara<span className="accent">.ai</span>
        </div>
        <nav>
          {NAV.filter((n) => !n.adminOnly || user.role === 'ADMIN' || user.role === 'DEVELOPER').map((n) => (
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
            <div className="avatar">{user.email[0]?.toUpperCase()}</div>
            <div className="user-meta">
              <div className="user-email">{user.email}</div>
              <div className="user-role">{user.role}</div>
            </div>
          </div>
          <button className="btn-ghost" onClick={() => void logout()}>
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
    </div>
  );
}
