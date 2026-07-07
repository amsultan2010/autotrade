'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AlpacaSetupGuide } from './AlpacaSetupGuide';
import { useAlpacaConnect } from './useAlpacaConnect';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Badge } from '@/src/components/ui/badge';
import { Card, CardContent } from '@/src/components/ui/card';

type BrokerStatus = {
  connected: boolean;
  paperConnected?: boolean;
  liveConnected?: boolean;
  provider?: string;
  paper?: boolean;
};

interface AlpacaConnectPanelProps {
  broker: BrokerStatus | null;
  liveEntitled?: boolean;
  onError?: (msg: string) => void;
  showGuide?: boolean;
  compactGuide?: boolean;
  className?: string;
}

const inputClassName =
  'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20';

function AlpacaKeyCard({
  title,
  subtitle,
  connected,
  paper,
  onError,
  compactGuide,
}: {
  title: string;
  subtitle: string;
  connected: boolean;
  paper: boolean;
  onError?: (msg: string) => void;
  compactGuide?: boolean;
}) {
  const {
    keyId,
    setKeyId,
    secret,
    setSecret,
    loading,
    confirming,
    setConfirming,
    connect,
    disconnect,
  } = useAlpacaConnect(paper, onError);

  return (
    <Card
      className={cn(
        'bg-surface-raised',
        connected && 'border-accent/40 ring-1 ring-accent/20',
      )}
    >
      <CardContent className="p-5">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-ink">{title}</h3>
            <p className="mt-0.5 text-sm text-ink-secondary">{subtitle}</p>
          </div>
          {connected && (
            <Badge variant="pos" className="shrink-0">
              <CheckCircle2 size={10} className="mr-1" aria-hidden />
              Connected
            </Badge>
          )}
        </header>

        {connected ? (
          confirming ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-ink-secondary">Remove these keys?</span>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => void disconnect()}
                disabled={loading}
              >
                Yes, disconnect
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(true)}>
              Disconnect
            </Button>
          )
        ) : (
          <>
            {!compactGuide && (
              <details className="mb-4 rounded-lg border border-border bg-surface">
                <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-ink-secondary hover:text-ink">
                  How to get Alpaca keys
                </summary>
                <div className="border-t border-border px-4 py-3">
                  <AlpacaSetupGuide compact />
                </div>
              </details>
            )}
            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`alpaca-key-${paper ? 'paper' : 'live'}`}>API Key ID</Label>
                <Input
                  id={`alpaca-key-${paper ? 'paper' : 'live'}`}
                  type="text"
                  placeholder="PKxxxxxxxxxxxxxxxx"
                  value={keyId}
                  onChange={(e) => setKeyId(e.target.value)}
                  autoComplete="off"
                  className={inputClassName}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`alpaca-secret-${paper ? 'paper' : 'live'}`}>Secret Key</Label>
                <Input
                  id={`alpaca-secret-${paper ? 'paper' : 'live'}`}
                  type="password"
                  placeholder="••••••••••••••••••••••••••••••••••••••••"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  autoComplete="off"
                  className={inputClassName}
                />
              </div>
            </div>
            <Button
              type="button"
              onClick={() => void connect()}
              disabled={loading || !keyId || !secret}
            >
              {loading ? 'Connecting…' : `Connect ${paper ? 'paper' : 'live'} Alpaca`}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function AlpacaConnectPanel({
  broker,
  liveEntitled = false,
  onError,
  showGuide = true,
  compactGuide = false,
  className = '',
}: AlpacaConnectPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const reportError = (msg: string) => {
    setError(msg);
    onError?.(msg);
  };

  if (liveEntitled) {
    return (
      <section
        className={cn(
          'alpaca-connect-panel overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]',
          className,
        )}
        data-tour="alpaca-connect"
      >
        <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted md:text-base">
          Alpaca accounts
        </h2>
        </div>
        <div className="space-y-4 p-5">
          <p className="text-sm leading-relaxed text-ink-secondary md:text-base">
            Save separate API keys for paper and live trading. Switch execution mode in Settings
            without re-entering keys. Without paper keys, PAPER mode uses the built-in simulator.
          </p>
          {error && (
            <div
              className="rounded-lg border border-negative/30 bg-negative-muted px-4 py-3 text-sm text-ink-secondary"
              role="alert"
            >
              {error}
            </div>
          )}
          {showGuide && <AlpacaSetupGuide compact={compactGuide} />}
          <div className="grid gap-4 lg:grid-cols-2">
            <AlpacaKeyCard
              title="Paper trading"
              subtitle="Alpaca paper sandbox — no real money"
              connected={broker?.paperConnected ?? false}
              paper
              onError={reportError}
              compactGuide
            />
            <AlpacaKeyCard
              title="Live trading"
              subtitle="Real Alpaca account — requires paid plan"
              connected={broker?.liveConnected ?? false}
              paper={false}
              onError={reportError}
              compactGuide
            />
          </div>
        </div>
      </section>
    );
  }

  const paperConnected = broker?.paperConnected ?? broker?.connected ?? false;

  return (
    <section
      className={cn(
        'alpaca-connect-panel overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]',
        className,
      )}
      data-tour="alpaca-connect"
    >
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted md:text-base">
          Connect Alpaca paper
        </h2>
      </div>
      <div className="space-y-4 p-5">
        <p className="text-sm leading-relaxed text-ink-secondary md:text-base">
          Free plans use paper trading only. Connect Alpaca paper keys to mirror bot trades in your
          brokerage sandbox, or use the built-in simulator without keys.
        </p>
        {error && (
          <div
            className="rounded-lg border border-negative/30 bg-negative-muted px-4 py-3 text-sm text-ink-secondary"
            role="alert"
          >
            {error}
          </div>
        )}
        {showGuide && <AlpacaSetupGuide compact={compactGuide} />}
        <AlpacaKeyCard
          title="Paper trading"
          subtitle="Alpaca paper sandbox"
          connected={paperConnected}
          paper
          onError={reportError}
        />
      </div>
    </section>
  );
}
