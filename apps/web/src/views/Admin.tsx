'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '../api/client';
import {
  PageShell,
  PageHeader,
  StatCard,
  Panel,
  Badge,
  DataTable,
} from '@/src/components/layout/PageShell';
import { Button } from '@/src/components/ui/button';
import { cn } from '@/lib/utils';

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
    <PageShell className="space-y-6">
      <PageHeader
        title="Admin"
        actions={<Badge variant="muted">DEVELOPER CONSOLE</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total users" value={metrics?.users ?? '—'} />
        <StatCard label="Active subs" value={metrics?.activeSubs ?? '—'} />
        <StatCard label="Open trades" value={metrics?.openTrades ?? '—'} />
        <StatCard label="Signals (24h)" value={metrics?.signals24h ?? '—'} />
      </div>

      <div className="relative max-w-md">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
          aria-hidden
        />
        <input
          type="search"
          className="h-10 w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-4 text-sm text-ink placeholder:text-ink-muted transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          placeholder="Search users by email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void load()}
        />
      </div>

      <Panel title="Users">
        <DataTable>
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
              <th className="pb-3 pr-4 font-semibold">Email</th>
              <th className="pb-3 pr-4 font-semibold">Role</th>
              <th className="pb-3 pr-4 font-semibold">Status</th>
              <th className="pb-3 pr-4 font-semibold">Subscription</th>
              <th className="pb-3 pr-4 font-semibold">Trades</th>
              <th className="pb-3 text-right font-semibold" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id} className="text-ink">
                <td className="py-3 pr-4 text-sm">{u.email}</td>
                <td className="py-3 pr-4">
                  <Badge variant="muted">{u.role}</Badge>
                </td>
                <td className="py-3 pr-4">
                  <Badge variant={u.status === 'ACTIVE' ? 'success' : 'danger'}>
                    {u.status}
                  </Badge>
                </td>
                <td className="py-3 pr-4 text-sm text-ink-secondary">
                  {u.subscription?.status ?? 'NONE'}
                </td>
                <td className="py-3 pr-4 font-mono text-sm tabular-nums">{u._count.trades}</td>
                <td className="py-3 text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(
                      u.status === 'ACTIVE'
                        ? 'text-negative hover:text-negative'
                        : 'text-positive hover:text-positive',
                    )}
                    onClick={() => void toggleStatus(u)}
                  >
                    {u.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                  </Button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-ink-secondary">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </DataTable>
      </Panel>
    </PageShell>
  );
}
