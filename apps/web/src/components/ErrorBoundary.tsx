import { Component, type ReactNode, type ErrorInfo } from 'react';
import { ErrorCodes, toTrackedError, type TrackedError } from '@autotrade/shared';
import { captureAppError } from '@/lib/error-tracking';
import { ErrorFallback } from '@/src/components/ErrorFallback';

interface Props { children: ReactNode }
interface State { error: TrackedError | null }

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return {
      error: toTrackedError(error, ErrorCodes.UI_RENDER, error.message),
    };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    captureAppError(ErrorCodes.UI_RENDER, error, {
      componentStack: info.componentStack,
    });
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
