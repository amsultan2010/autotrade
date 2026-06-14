import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/ui/themes';
import './globals.css';

export const metadata: Metadata = {
  title: 'Autotrade',
  description: 'AI-powered paper trading bot',
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
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
