import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/ui/themes';
import { IBM_Plex_Mono, Inter, Syne } from 'next/font/google';
import { PostHogProvider } from '@/lib/posthog';
import { PostHogPageView } from '@/lib/posthog-pageview';
import { SentryErrorListeners } from '@/components/SentryErrorListeners';
import { AppProviders } from '@/components/providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  weight: ['600', '700', '800'],
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
  title: 'Autotrade — Obsidian Trading Console',
  description: 'AI-powered automated trading with premium instrument-panel UI',
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
    <html lang="en" className={`${inter.variable} ${syne.variable} ${ibmPlexMono.variable}`}>
      <body className="min-h-dvh bg-bg text-ink antialiased">
        <ClerkProvider
          appearance={{
            theme: dark,
            variables: {
              colorBackground: '#0c0c12',
              colorInputBackground: '#12121a',
              colorInputText: '#f4f8fd',
              colorText: '#f4f8fd',
              colorTextSecondary: '#9eb0c4',
              colorPrimary: '#d4af37',
              colorDanger: '#ff3b52',
              colorSuccess: '#00c896',
              colorNeutral: '#9eb0c4',
              borderRadius: '12px',
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
