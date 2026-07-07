'use client';

import { useState } from 'react';
import { AlpacaSetupGuide } from './AlpacaSetupGuide';
import { useAlpacaConnect } from './useAlpacaConnect';

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

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
    <article className={`alpaca-key-card${connected ? ' alpaca-key-card--connected' : ''}`}>
      <header className="alpaca-key-card-header">
        <h3>{title}</h3>
        <p className="muted">{subtitle}</p>
        {connected && <span className="alpaca-key-card-badge">Connected</span>}
      </header>

      {connected ? (
        confirming ? (
          <div className="row gap">
            <span className="muted">Remove these keys?</span>
            <button type="button" className="btn-danger" onClick={() => void disconnect()} disabled={loading}>
              Yes, disconnect
            </button>
            <button type="button" className="btn-ghost" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className="btn-ghost" onClick={() => setConfirming(true)}>
            Disconnect
          </button>
        )
      ) : (
        <>
          {!compactGuide && (
            <details className="alpaca-guide-details">
              <summary>How to get Alpaca keys</summary>
              <AlpacaSetupGuide compact />
            </details>
          )}
          <div className="form-grid" style={{ marginBottom: '1rem' }}>
            <Field label="API Key ID">
              <input
                type="text"
                placeholder="PKxxxxxxxxxxxxxxxx"
                value={keyId}
                onChange={(e) => setKeyId(e.target.value)}
                autoComplete="off"
              />
            </Field>
            <Field label="Secret Key">
              <input
                type="password"
                placeholder="••••••••••••••••••••••••••••••••••••••••"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                autoComplete="off"
              />
            </Field>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void connect()}
            disabled={loading || !keyId || !secret}
          >
            {loading ? 'Connecting…' : `Connect ${paper ? 'paper' : 'live'} Alpaca`}
          </button>
        </>
      )}
    </article>
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
      <section className={`panel alpaca-connect-panel ${className}`.trim()} data-tour="alpaca-connect">
        <h2>Alpaca accounts</h2>
        <p className="muted alpaca-connect-intro">
          Save separate API keys for paper and live trading. Switch execution mode in Settings without re-entering keys.
          Without paper keys, PAPER mode uses the built-in simulator.
        </p>
        {error && <div className="error-banner" style={{ marginBottom: '1rem' }}>{error}</div>}
        {showGuide && <AlpacaSetupGuide compact={compactGuide} />}
        <div className="alpaca-dual-grid">
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
      </section>
    );
  }

  const paperConnected = broker?.paperConnected ?? broker?.connected ?? false;

  return (
    <section className={`panel alpaca-connect-panel ${className}`.trim()} data-tour="alpaca-connect">
      <h2>Connect Alpaca paper</h2>
      <p className="muted alpaca-connect-intro">
        Free plans use paper trading only. Connect Alpaca paper keys to mirror bot trades in your brokerage sandbox,
        or use the built-in simulator without keys.
      </p>
      {error && <div className="error-banner" style={{ marginBottom: '1rem' }}>{error}</div>}
      {showGuide && <AlpacaSetupGuide compact={compactGuide} />}
      <AlpacaKeyCard
        title="Paper trading"
        subtitle="Alpaca paper sandbox"
        connected={paperConnected}
        paper
        onError={reportError}
      />
    </section>
  );
}
