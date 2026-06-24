'use client';
import { ConstellationBg } from './ConstellationBg';
import { ScanlineOverlay } from './ScanlineOverlay';

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <ConstellationBg dim />
      <ScanlineOverlay />
      <a href="#auth-main" className="skip-link">Skip to sign in</a>
      <div className="auth-shell-inner" id="auth-main">
        <a href="/" className="auth-shell-brand">
          <div className="brand-mark">AT</div>
          <span className="brand-name">Autotrade</span>
        </a>
        <p className="auth-shell-tagline">
          Precision terminal for AI-driven trading — paper first, live when you are ready.
        </p>
        <div className="auth-shell-card">{children}</div>
      </div>
    </div>
  );
}
