import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/ui/themes';
import { IBM_Plex_Mono, Inter, Plus_Jakarta_Sans } from 'next/font/google';
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

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  weight: ['500', '600', '700', '800'],
  display: 'swap',
});

const jetbrains = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  weight: ['400', '500', '600'],
  display: 'swap',
});

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Autotrade — AI Trading Console',
  description: 'AI-powered automated trading with paper and live execution',
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
    <html
      lang="en"
      className={`${inter.variable} ${jakarta.variable} ${jetbrains.variable}`}
    >
      <body className="min-h-dvh bg-bg text-ink antialiased">
        <ClerkProvider
          appearance={{
            theme: dark,
            variables: {
              colorBackground: '#111113',
              colorInputBackground: '#1a1a1f',
              colorInputText: '#fafafa',
              colorText: '#fafafa',
              colorTextSecondary: '#a1a1aa',
              colorPrimary: '#38bdf8',
              colorDanger: '#f87171',
              colorSuccess: '#34d399',
              colorNeutral: '#a1a1aa',
              borderRadius: '10px',
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
