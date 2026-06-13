import { SignIn, SignUp } from '@clerk/react';
import { useState } from 'react';

const clerkAppearance = {
  variables: {
    colorBackground: 'rgba(14, 19, 24, 0.0)',
    colorInputBackground: 'rgba(0,0,0,0.3)',
    colorInputText: '#eef2f7',
    colorText: '#eef2f7',
    colorTextSecondary: '#7e94a8',
    colorPrimary: '#00c896',
    colorDanger: '#ff3b52',
    colorSuccess: '#00c896',
    borderRadius: '6px',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: '15px',
    spacingUnit: '18px',
  },
  elements: {
    card: {
      background: 'transparent',
      boxShadow: 'none',
      padding: '0',
    },
    headerTitle: {
      display: 'none',
    },
    headerSubtitle: {
      display: 'none',
    },
    socialButtonsBlockButton: {
      background: 'rgba(0,0,0,0.3)',
      border: '1px solid rgba(255,255,255,0.11)',
      color: '#eef2f7',
      borderRadius: '6px',
      fontSize: '14px',
      fontWeight: '500',
    },
    dividerLine: {
      background: 'rgba(255,255,255,0.06)',
    },
    dividerText: {
      color: '#3f5165',
      fontSize: '12px',
    },
    formFieldLabel: {
      color: '#3f5165',
      fontSize: '12px',
      fontWeight: '600',
      letterSpacing: '0.8px',
      textTransform: 'uppercase',
      marginBottom: '7px',
    },
    formFieldInput: {
      background: 'rgba(0,0,0,0.3)',
      border: '1px solid rgba(255,255,255,0.11)',
      color: '#eef2f7',
      padding: '14px 16px',
      borderRadius: '6px',
      fontSize: '16px',
    },
    formFieldInputShowPasswordButton: {
      color: '#7e94a8',
    },
    formButtonPrimary: {
      background: '#00c896',
      color: '#031a12',
      border: '0',
      padding: '14px 22px',
      borderRadius: '6px',
      fontWeight: '700',
      fontSize: '15px',
    },
    footerActionLink: {
      color: '#00c896',
      fontWeight: '600',
    },
    footerActionText: {
      color: '#7e94a8',
    },
    identityPreviewText: {
      color: '#eef2f7',
    },
    identityPreviewEditButton: {
      color: '#00c896',
    },
    formResendCodeLink: {
      color: '#00c896',
    },
    otpCodeFieldInput: {
      background: 'rgba(0,0,0,0.3)',
      border: '1px solid rgba(255,255,255,0.11)',
      color: '#eef2f7',
      borderRadius: '6px',
    },
    alert: {
      background: 'rgba(255,59,82,0.12)',
      border: '1px solid rgba(255,59,82,0.3)',
      borderRadius: '6px',
    },
    alertText: {
      color: '#ff3b52',
    },
  },
};

export function Login() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="logo-lg">Autotrade</div>
        <p className="muted">AI-powered trading, personalized to you.</p>

        <div className="seg">
          <button className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>
            Sign in
          </button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>
            Create account
          </button>
        </div>

        <div style={{ marginTop: 10 }}>
          {mode === 'signin' ? (
            <SignIn
              appearance={clerkAppearance}
              fallbackRedirectUrl="/"
            />
          ) : (
            <SignUp
              appearance={clerkAppearance}
              fallbackRedirectUrl="/"
            />
          )}
        </div>

        <p className="fine-print">A subscription is required after creating your account.</p>
      </div>
    </div>
  );
}
