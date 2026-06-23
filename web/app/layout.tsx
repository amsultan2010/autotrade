import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/ui/themes';
import { PostHogProvider } from '@/lib/posthog';
import { PostHogPageView } from '@/lib/posthog-pageview';
import { SentryErrorListeners } from '@/components/SentryErrorListeners';
import { ConvexClerkProvider } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Autotrade',
  description: 'AI-powered automated trading bot',
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
    <html lang="en">
      <body>
        <ClerkProvider
          appearance={{
            theme: dark,
            variables: {
              colorBackground: '#0e1318',
              colorInputBackground: '#090c10',
              colorInputText: '#f4f8fd',
              colorText: '#f4f8fd',
              colorTextSecondary: '#a8bece',
              colorPrimary: '#00c896',
              colorDanger: '#ff3b52',
              colorSuccess: '#00c896',
              colorNeutral: '#a8bece',
              borderRadius: '8px',
              fontFamily: 'Inter, system-ui, sans-serif',
              fontFamilyButtons: 'Inter, system-ui, sans-serif',
              fontSize: '15px',
            },
          }}
        >
          <ConvexClerkProvider>
            <PostHogProvider>
              <SentryErrorListeners />
              <PostHogPageView />
              {children}
            </PostHogProvider>
          </ConvexClerkProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
