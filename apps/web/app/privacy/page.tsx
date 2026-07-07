import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — Autotrade',
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 text-ink">
      <p className="font-mono text-xs uppercase tracking-widest text-teal">Legal</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink">Privacy Policy</h1>
      <p className="mt-2 text-sm text-ink-secondary">Last updated: July 7, 2026</p>

      <div className="prose prose-invert mt-8 max-w-none space-y-6 text-sm leading-relaxed text-ink-secondary [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink">
        <section>
          <h2>What we collect</h2>
          <p>
            Account information from Clerk (email, user id), trading configuration, watchlists,
            signals, and trade history stored in Supabase, broker API credentials (encrypted at
            rest), and usage analytics via PostHog when enabled.
          </p>
        </section>
        <section>
          <h2>How we use data</h2>
          <p>
            To operate the trading bot, display your dashboard, send optional email digests, improve
            reliability, and comply with legal obligations. We do not sell your personal information.
          </p>
        </section>
        <section>
          <h2>Third parties</h2>
          <p>
            We use Clerk (auth), Supabase (database), Vercel (hosting), Alpaca (brokerage when you
            connect), Resend (email), Sentry (error monitoring), and PostHog (analytics). Each
            provider processes data under their own policies.
          </p>
        </section>
        <section>
          <h2>Your choices</h2>
          <p>
            You may disable weekly digests in Settings, disconnect Alpaca keys, or delete your
            account by contacting support. EU/UK users may request access or deletion at{' '}
            <a href="mailto:abdullahmsultan1@gmail.com" className="text-teal hover:underline">
              abdullahmsultan1@gmail.com
            </a>
            .
          </p>
        </section>
        <section>
          <h2>Contact</h2>
          <p>
            Questions:{' '}
            <a href="mailto:abdullahmsultan1@gmail.com" className="text-teal hover:underline">
              abdullahmsultan1@gmail.com
            </a>
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
