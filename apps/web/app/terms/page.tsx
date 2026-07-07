import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — Autotrade',
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 text-ink">
      <p className="font-mono text-xs uppercase tracking-widest text-teal">Legal</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink">Terms of Service</h1>
      <p className="mt-2 text-sm text-ink-secondary">Last updated: July 7, 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink-secondary">
        <section>
          <h2 className="text-base font-semibold text-ink">Agreement</h2>
          <p>
            By using Autotrade you agree to these terms. If you do not agree, do not use the
            service. Autotrade is software that helps you automate trading workflows; we are not a
            broker-dealer or investment adviser.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-ink">Eligibility</h2>
          <p>
            You must be at least 18 years old and legally able to enter contracts in your
            jurisdiction. You are responsible for compliance with local laws regarding automated
            trading.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-ink">Trading risk</h2>
          <p>
            Trading securities and crypto involves substantial risk of loss. Past performance does
            not guarantee future results. See our{' '}
            <Link href="/risk-disclosure" className="text-teal hover:underline">
              Risk Disclosure
            </Link>{' '}
            before enabling live trading.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-ink">Your account</h2>
          <p>
            Keep credentials secure. You are responsible for activity under your account. Do not
            misuse the API or attempt to access other users&apos; data.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-ink">Service availability</h2>
          <p>
            We strive for reliability but do not guarantee uninterrupted operation. Maintenance,
            market closures, or third-party outages may affect scans and execution.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-ink">Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, Autotrade is provided &quot;as is&quot; without
            warranties. We are not liable for trading losses, missed signals, or indirect damages.
          </p>
        </section>
      </div>

      <p className="mt-12 text-sm">
        <Link href="/" className="text-teal hover:underline">
          ← Back to home
        </Link>
      </p>
    </article>
  );
}
