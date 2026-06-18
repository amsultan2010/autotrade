import { ClerkProvider } from '@clerk/react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './state/auth';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles.css';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;
if (!publishableKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env.local');

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/">
      <AuthProvider>
        <App />
      </AuthProvider>
    </ClerkProvider>
  </ErrorBoundary>,
);
