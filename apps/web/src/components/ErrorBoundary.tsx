import { Component, type ReactNode, type ErrorInfo } from 'react';
import { ErrorCodes, type TrackedError } from '@autotrade/shared';
import { reportTrackedError } from '@/lib/error-tracking';
import { ErrorFallback } from '@/src/components/ErrorFallback';

interface Props { children: ReactNode }
interface State { error: TrackedError | null }

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  override componentDidCatch(error: Error, info: ErrorInfo) {
    const tracked = reportTrackedError(ErrorCodes.UI_RENDER, error, {
      componentStack: info.componentStack,
      route: typeof window !== 'undefined' ? window.location.pathname : undefined,
    });
    this.setState({ error: tracked });
  }

  override render() {
    if (this.state.error) {
      return (
        <ErrorFallback
          error={this.state.error}
          onRetry={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}
