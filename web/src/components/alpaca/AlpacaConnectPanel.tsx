'use client';

import { AlpacaSetupGuide } from './AlpacaSetupGuide';
import { useAlpacaConnect } from './useAlpacaConnect';

type BrokerStatus = { connected: boolean; provider?: string; paper?: boolean };

interface AlpacaConnectPanelProps {
  broker: BrokerStatus | null;
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

export function AlpacaConnectPanel({
  broker,
  onError,
  showGuide = true,
  compactGuide = false,
  className = '',
}: AlpacaConnectPanelProps) {
  const {
    keyId,
    setKeyId,
    secret,
    setSecret,
    paper,
    setPaper,
    loading,
    confirming,
    setConfirming,
    connect,
    disconnect,
  } = useAlpacaConnect(onError);

  if (broker?.connected) {
    return (
      <section className={`panel alpaca-connect-panel ${className}`.trim()}>
        <h2>Alpaca account</h2>
        <p className="muted" style={{ marginBottom: '1rem' }}>
          Connected · {broker.paper ? 'Paper trading' : 'Live trading'}
        </p>
        {showGuide && (
          <details className="alpaca-guide-details">
            <summary>How to connect Alpaca (reference)</summary>
            <AlpacaSetupGuide compact />
          </details>
        )}
        {confirming ? (
          <div className="row gap">
            <span className="muted">Remove your Alpaca connection?</span>
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
        )}
      </section>
    );
  }

  return (
    <section className={`panel alpaca-connect-panel ${className}`.trim()} data-tour="alpaca-connect">
      <h2>Connect Alpaca</h2>
      <p className="muted alpaca-connect-intro">
        Connect Alpaca paper keys to mirror bot trades in your brokerage sandbox.
        Without keys, the bot uses the built-in $100,000 simulator.
      </p>

      {showGuide && <AlpacaSetupGuide compact={compactGuide} />}

      <div className="alpaca-connect-form">
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
        <div className="row gap" style={{ marginBottom: '1rem' }}>
          <label className="row gap" style={{ cursor: 'pointer', gap: '0.5rem' }}>
            <input type="checkbox" checked={paper} onChange={(e) => setPaper(e.target.checked)} />
            <span>Paper trading (safe — no real money)</span>
          </label>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => void connect()}
          disabled={loading || !keyId || !secret}
        >
          {loading ? 'Connecting…' : 'Connect Alpaca'}
        </button>
      </div>
    </section>
  );
}
