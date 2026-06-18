import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/ui/themes';
import { PostHogProvider } from '@/lib/posthog';
import { PostHogPageView } from '@/lib/posthog-pageview';
import './globals.css';

export const metadata: Metadata = {
  title: 'Autotrade',
  description: 'AI-powered automated trading bot',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    title: 'Autotrade',
    description: 'AI-powered automated trading bot',
    siteName: 'Autotrade',
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
          <PostHogProvider>
            <PostHogPageView />
            {children}
          </PostHogProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
