import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { DM_Sans, Fraunces, IBM_Plex_Mono } from 'next/font/google';
import { PostHogProvider } from '@/lib/posthog';
import { PostHogPageView } from '@/lib/posthog-pageview';
import { SentryErrorListeners } from '@/components/SentryErrorListeners';
import { AppProviders } from '@/components/providers';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-ibm-mono',
  weight: ['400', '500', '600'],
  display: 'swap',
});

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Autotrade — AI Trading, Built for You',
  description: 'Premium AI-powered trading with warm, intuitive controls and institutional-grade signals',
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon.png', sizes: '1024x1024', type: 'image/png' },
    ],
    shortcut: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Autotrade',
    description: 'AI-powered automated trading bot',
    siteName: 'Autotrade',
    images: [{ url: '/icon.png', width: 1024, height: 1024, alt: 'Autotrade' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${fraunces.variable} ${ibmPlexMono.variable}`}>
      <body className="min-h-dvh bg-bg text-ink antialiased">
        <ClerkProvider
          appearance={{
            variables: {
              colorBackground: '#ffffff',
              colorInputBackground: '#f5f0e8',
              colorInputText: '#1c1917',
              colorText: '#1c1917',
              colorTextSecondary: '#57534e',
              colorPrimary: '#e85d04',
              colorDanger: '#dc2626',
              colorSuccess: '#15803d',
              colorNeutral: '#a8a29e',
              borderRadius: '14px',
              fontFamily: 'var(--font-sans)',
              fontFamilyButtons: 'var(--font-sans)',
              fontSize: '15px',
            },
          }}
        >
          <AppProviders>
            <PostHogProvider>
              <SentryErrorListeners />
              <PostHogPageView />
              {children}
            </PostHogProvider>
          </AppProviders>
        </ClerkProvider>
      </body>
    </html>
  );
}
