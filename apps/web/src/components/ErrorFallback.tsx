'use client';

import { TrackedError, type ErrorCode } from '@autotrade/shared';

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
  const displayCode = code ?? (error instanceof TrackedError ? error.code : undefined);
  const displayRefId = refId ?? (error instanceof TrackedError ? error.refId : undefined);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh', gap: '16px',
      background: '#090c10', color: '#eef2f7', fontFamily: 'IBM Plex Mono, monospace',
      padding: '40px',
    }}>
      <div style={{
        fontSize: '13px', color: '#ff3b52', letterSpacing: '2px',
        textTransform: 'uppercase', fontWeight: 700,
      }}>
        Something went wrong
      </div>

      <div style={{
        fontSize: '14px', color: '#7e94a8', maxWidth: '520px',
        textAlign: 'center', lineHeight: 1.6,
      }}>
        {error.message || 'An unexpected error occurred.'}
      </div>

      {(displayCode || displayRefId || digest) && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '6px',
          marginTop: '4px', padding: '12px 16px',
          background: 'rgba(255,255,255,0.04)', borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.08)',
          fontSize: '12px', color: '#5a7084', minWidth: '280px',
        }}>
          {displayCode && (
            <div>
              <span style={{ color: '#7e94a8' }}>Code: </span>
              <code style={{ color: '#c8d6e0' }}>{displayCode}</code>
            </div>
          )}
          {displayRefId && (
            <div>
              <span style={{ color: '#7e94a8' }}>Reference: </span>
              <code style={{ color: '#00c896', fontWeight: 600 }}>{displayRefId}</code>
            </div>
          )}
          {digest && (
            <div>
              <span style={{ color: '#7e94a8' }}>Digest: </span>
              <code style={{ color: '#c8d6e0' }}>{digest}</code>
            </div>
          )}
        </div>
      )}

      <p style={{ fontSize: '12px', color: '#5a7084', margin: 0 }}>
        This error was reported automatically. Share the reference ID if you contact support.
      </p>

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
