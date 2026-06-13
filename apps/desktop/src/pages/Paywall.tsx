import { useState } from 'react';
import { useAuth } from '../state/auth';
import { api, ApiError } from '../api/client';

export function Paywall() {
  const { logout, refreshSubscription } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subscribe() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await api.checkout();
      await window.alphabot.openExternal(url); // Stripe Checkout in the system browser
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start checkout');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card wide">
        <div className="logo-lg">
          Quantara<span className="accent">.ai</span> Pro
        </div>
        <p className="muted">One plan. Full access. Cancel anytime.</p>

        <ul className="feature-list">
          <li>Unlimited global watchlist symbols</li>
          <li>Multi-timeframe chart analysis &amp; explained signals</li>
          <li>Paper trading on real market data</li>
          <li>Personalized learning from your results</li>
          <li>Full performance &amp; trade history</li>
        </ul>

        {error && <div className="error-banner">{error}</div>}

        <button className="btn-primary full" disabled={busy} onClick={() => void subscribe()}>
          {busy ? 'Opening checkout…' : 'Subscribe to Quantara Pro'}
        </button>
        <button className="btn-ghost full" onClick={() => void refreshSubscription()}>
          I've already subscribed — refresh status
        </button>
        <button className="btn-text" onClick={() => void logout()}>
          Sign out
        </button>
      </div>
    </div>
  );
}
