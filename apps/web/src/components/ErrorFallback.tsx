'use client';

import { useState } from 'react';
import { TrackedError, ErrorCodes, type ErrorCode } from '@autotrade/shared';

interface ErrorFallbackProps {
  error: TrackedError | Error;
  code?: ErrorCode;
  refId?: string;
  digest?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorFallback({
  error,
  code,
  refId,
  digest,
  onRetry,
  retryLabel = 'Try again',
}: ErrorFallbackProps) {
  const [copied, setCopied] = useState(false);
  const displayCode = code ?? (error instanceof TrackedError ? error.code : ErrorCodes.UNKNOWN);
  const displayRefId = refId ?? (error instanceof TrackedError ? error.refId : undefined);
  const displayMessage = error.message || 'An unexpected error occurred.';
  const isDev = process.env.NODE_ENV === 'development';
  const stack = error instanceof Error ? error.stack : undefined;

  async function copyRef() {
    if (!displayRefId) return;
    try {
      await navigator.clipboard.writeText(displayRefId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh', gap: '14px',
      background: '#090c10', color: '#eef2f7', fontFamily: 'IBM Plex Mono, monospace',
      padding: '40px',
    }}>
      <div style={{
        fontSize: '13px', color: '#ff3b52', letterSpacing: '2px',
        textTransform: 'uppercase', fontWeight: 700,
      }}>
        {displayCode.replace(/_/g, ' ')}
      </div>

      <div style={{
        fontSize: '15px', color: '#eef2f7', maxWidth: '640px',
        textAlign: 'center', lineHeight: 1.65, fontWeight: 500,
        wordBreak: 'break-word',
      }}>
        {displayMessage}
      </div>

      <div style={{
        display: 'flex', flexDirection: 'column', gap: '8px',
        marginTop: '4px', padding: '14px 18px',
        background: 'rgba(255,255,255,0.04)', borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.1)',
        fontSize: '12px', color: '#7e94a8', minWidth: '300px', width: '100%', maxWidth: '520px',
      }}>
        <div>
          <span style={{ color: '#5a7084' }}>Error code: </span>
          <code style={{ color: '#c8d6e0', fontWeight: 600 }}>{displayCode}</code>
        </div>
        {displayRefId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span>
              <span style={{ color: '#5a7084' }}>Reference: </span>
              <code style={{ color: '#00c896', fontWeight: 700 }}>{displayRefId}</code>
            </span>
            <button
              type="button"
              onClick={() => void copyRef()}
              style={{
                background: 'transparent', border: '1px solid rgba(0,200,150,0.35)',
                color: '#00c896', borderRadius: '4px', padding: '2px 8px',
                fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
        {digest && (
          <div>
            <span style={{ color: '#5a7084' }}>Digest: </span>
            <code style={{ color: '#c8d6e0' }}>{digest}</code>
          </div>
        )}
        {error.name && error.name !== 'Error' && error.name !== 'TrackedError' && (
          <div>
            <span style={{ color: '#5a7084' }}>Type: </span>
            <code style={{ color: '#c8d6e0' }}>{error.name}</code>
          </div>
        )}
      </div>

      <p style={{ fontSize: '12px', color: '#5a7084', margin: 0, maxWidth: '480px', textAlign: 'center' }}>
        This error was reported to Sentry automatically. Share the reference ID when contacting support.
      </p>

      {isDev && stack && (
        <pre style={{
          marginTop: '8px', padding: '12px', maxWidth: '720px', width: '100%',
          overflow: 'auto', fontSize: '11px', lineHeight: 1.45,
          background: 'rgba(0,0,0,0.35)', borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.06)', color: '#7e94a8',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {stack}
        </pre>
      )}

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: '8px', background: '#00c896', color: '#031a12',
            border: 0, padding: '12px 24px', borderRadius: '6px',
            fontWeight: 700, fontSize: '14px', cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
