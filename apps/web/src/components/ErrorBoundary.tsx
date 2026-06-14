import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

// Error boundaries must be class components — React has no hook equivalent.
// noImplicitOverride requires the `override` keyword on render() but not on
// the static lifecycle getDerivedStateFromError (it's not on Component's prototype).
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  // Static lifecycle — not inherited from Component, so no `override` needed.
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100vh', gap: '16px',
          background: '#090c10', color: '#eef2f7', fontFamily: 'IBM Plex Mono, monospace',
          padding: '40px',
        }}>
          <div style={{ fontSize: '13px', color: '#ff3b52', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 700 }}>
            Runtime Error
          </div>
          <div style={{ fontSize: '14px', color: '#7e94a8', maxWidth: '500px', textAlign: 'center', lineHeight: 1.6 }}>
            {this.state.error.message}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: '8px', background: '#00c896', color: '#031a12',
              border: 0, padding: '12px 24px', borderRadius: '6px',
              fontWeight: 700, fontSize: '14px', cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
