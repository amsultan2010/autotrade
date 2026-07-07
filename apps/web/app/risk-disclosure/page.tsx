import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Risk Disclosure — Autotrade',
};

export default function RiskDisclosurePage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 text-ink">
      <p className="font-mono text-xs uppercase tracking-widest text-red">Important</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink">Risk Disclosure</h1>
      <p className="mt-2 text-sm text-ink-secondary">Read before enabling live trading</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink-secondary">
        <p className="rounded-lg border border-red/30 bg-red-muted px-4 py-3 text-ink">
          Automated trading can amplify losses. Only trade with capital you can afford to lose.
        </p>
        <section>
          <h2 className="text-base font-semibold text-ink">No investment advice</h2>
          <p>
            Autotrade provides tools and signals, not personalized investment advice. Strategy
            outputs are algorithmic and may be wrong. You are solely responsible for decisions to
            enable the bot, select strategies, and connect a live brokerage account.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-ink">Paper vs live</h2>
          <p>
            Paper trading and simulators do not reflect slippage, partial fills, latency, or
            emotional pressure of real markets. Results in paper mode are not indicative of live
            performance.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-ink">System limits</h2>
          <p>
            Scans run on a schedule and may miss fast-moving markets. API rate limits, broker
            outages, or configuration errors can prevent orders from executing as expected.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-ink">Acknowledgment</h2>
          <p>
            By enabling <strong className="text-ink">LIVE</strong> mode in Settings you confirm you
            understand these risks and accept full responsibility for outcomes.
          </p>
        </section>
      </div>

      <p className="mt-12 flex flex-wrap gap-4 text-sm">
        <Link href="/terms" className="text-teal hover:underline">
          Terms of Service
        </Link>
        <Link href="/" className="text-teal hover:underline">
          ← Back to home
        </Link>
      </p>
    </article>
  );
}
