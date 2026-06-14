'use client';
import { useEffect, useState } from 'react';
import { api } from '../api/client';

type AdminUser = Awaited<ReturnType<typeof api.adminUsers>>[number];

export function Admin() {
  const [metrics, setMetrics] = useState<Awaited<ReturnType<typeof api.adminMetrics>> | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState('');

  async function load() {
    const [m, u] = await Promise.all([api.adminMetrics(), api.adminUsers(q)]);
    setMetrics(m);
    setUsers(u);
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleStatus(u: AdminUser) {
    await api.adminSetStatus(u.id, u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE');
    await load();
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Admin</h1>
        <span className="badge badge-off">DEVELOPER CONSOLE</span>
      </header>

      <div className="card-grid">
        <Stat label="Total users" value={String(metrics?.users ?? '—')} />
        <Stat label="Active subs" value={String(metrics?.activeSubs ?? '—')} />
        <Stat label="Open trades" value={String(metrics?.openTrades ?? '—')} />
        <Stat label="Signals (24h)" value={String(metrics?.signals24h ?? '—')} />
      </div>

      <div className="search-wrap">
        <input
          className="search"
          placeholder="Search users by email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void load()}
        />
      </div>

      <section className="panel">
        <table className="tbl">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Subscription</th>
              <th>Trades</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td><span className="tag">{u.role}</span></td>
                <td>
                  <span className={`pill ${u.status === 'ACTIVE' ? 'pill-win' : 'pill-loss'}`}>{u.status}</span>
                </td>
                <td className="muted">{u.subscription?.status ?? 'NONE'}</td>
                <td>{u._count.trades}</td>
                <td className="right">
                  <button className="btn-text danger" onClick={() => void toggleStatus(u)}>
                    {u.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
