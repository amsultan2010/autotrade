import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/ui/themes';
import { Chakra_Petch, IBM_Plex_Sans, JetBrains_Mono } from 'next/font/google';
import { PostHogProvider } from '@/lib/posthog';
import { PostHogPageView } from '@/lib/posthog-pageview';
import { SentryErrorListeners } from '@/components/SentryErrorListeners';
import { AppProviders } from '@/components/providers';
import './globals.css';

const ibmSans = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-ibm-sans',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const chakra = Chakra_Petch({
  subsets: ['latin'],
  variable: '--font-chakra',
  weight: ['500', '600', '700'],
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Autotrade — HyperForge Trading Console',
  description: 'Skeuomorphic AI trading terminal with institutional-grade signals and execution',
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
    <html lang="en" className={`${ibmSans.variable} ${chakra.variable} ${jetbrains.variable}`}>
      <body className="min-h-dvh bg-bg text-ink antialiased">
        <ClerkProvider
          appearance={{
            theme: dark,
            variables: {
              colorBackground: '#08080f',
              colorInputBackground: '#0e0e18',
              colorInputText: '#e8f4fc',
              colorText: '#e8f4fc',
              colorTextSecondary: '#7a9bb8',
              colorPrimary: '#00c896',
              colorDanger: '#ff3b52',
              colorSuccess: '#00c896',
              colorNeutral: '#7a9bb8',
              borderRadius: '8px',
              fontFamily: 'var(--font-sans)',
              fontFamilyButtons: 'var(--font-display)',
              fontSize: '14px',
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
