'use client';

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/12 via-bg to-bg"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,200,150,0.15),transparent)]"
        aria-hidden
      />

      <a
        href="#auth-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-bg"
      >
        Skip to sign in
      </a>

      <div className="relative z-10 w-full max-w-md" id="auth-main">
        <a
          href="/"
          className="mb-6 flex items-center justify-center gap-2.5 text-ink transition-opacity hover:opacity-80"
        >
          <img src="/icon.png" alt="" width={32} height={32} className="rounded-lg" />
          <span className="font-display text-xl font-bold tracking-tight">Autotrade</span>
        </a>

        <p className="mb-8 text-center text-sm leading-relaxed text-ink-secondary">
          Precision terminal for AI-driven trading. Paper first, live when you are ready.
        </p>

        <div className="rounded-xl border border-border bg-surface-raised p-6 shadow-[var(--shadow-card)] sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
