import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'Autotrade',
  description: 'AI-powered paper trading bot',
};

const clerkAppearance = {
  variables: {
    colorBackground: '#0e1318',
    colorInputBackground: 'rgba(0,0,0,0.3)',
    colorInputText: '#eef2f7',
    colorText: '#eef2f7',
    colorTextSecondary: '#7e94a8',
    colorPrimary: '#00c896',
    colorDanger: '#ff3b52',
    colorSuccess: '#00c896',
    colorNeutral: '#7e94a8',
    borderRadius: '6px',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontFamilyButtons: 'Inter, system-ui, sans-serif',
    fontSize: '15px',
  },
  elements: {
    card: {
      background: 'rgba(14,19,24,0.92)',
      border: '1px solid rgba(255,255,255,0.11)',
      borderRadius: '16px',
      boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      backdropFilter: 'blur(28px)',
    },
    headerTitle: {
      fontFamily: 'Syne, sans-serif',
      fontWeight: '700',
      letterSpacing: '-0.4px',
      color: '#eef2f7',
    },
    headerSubtitle: { color: '#7e94a8' },
    socialButtonsBlockButton: {
      background: 'rgba(0,0,0,0.3)',
      border: '1px solid rgba(255,255,255,0.11)',
      color: '#eef2f7',
    },
    socialButtonsBlockButton__hover: {
      background: '#131a22',
    },
    dividerLine: { background: 'rgba(255,255,255,0.06)' },
    dividerText: { color: '#3f5165' },
    formFieldLabel: {
      fontSize: '12px',
      fontWeight: '600',
      letterSpacing: '0.8px',
      textTransform: 'uppercase',
      color: '#3f5165',
    },
    formFieldInput: {
      background: 'rgba(0,0,0,0.3)',
      border: '1px solid rgba(255,255,255,0.11)',
      color: '#eef2f7',
      borderRadius: '6px',
      fontSize: '16px',
    },
    formFieldInput__focus: {
      borderColor: '#00c896',
      boxShadow: '0 0 0 3px rgba(0,200,150,0.18)',
    },
    formButtonPrimary: {
      background: '#00c896',
      color: '#031a12',
      fontWeight: '700',
      borderRadius: '6px',
    },
    footerActionLink: { color: '#00c896' },
    identityPreview: {
      background: 'rgba(0,0,0,0.3)',
      border: '1px solid rgba(255,255,255,0.11)',
    },
    navbar: { background: '#0e1318' },
    navbarButton: { color: '#7e94a8' },
    navbarButton__active: { color: '#00c896' },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider appearance={clerkAppearance}>{children}</ClerkProvider>
      </body>
    </html>
  );
}
