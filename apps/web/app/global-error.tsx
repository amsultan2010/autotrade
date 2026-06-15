'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#090c10', color: '#f4f8fd', fontFamily: 'Inter, sans-serif' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Something went wrong</h1>
          <p style={{ color: '#a8bece', marginBottom: '2rem' }}>This error has been reported automatically.</p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '10px 24px', background: '#00c896', color: '#090c10', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
          >
            Reload page
          </button>
        </div>
      </body>
    </html>
  );
}
