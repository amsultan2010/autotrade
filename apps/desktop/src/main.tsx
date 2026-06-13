import { ClerkProvider } from '@clerk/react';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './state/auth';
import { App } from './App';
import './styles.css';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/">
      <AuthProvider>
        <App />
      </AuthProvider>
    </ClerkProvider>
  </React.StrictMode>,
);