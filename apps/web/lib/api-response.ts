import { NextResponse } from 'next/server';
import { AppError, MarketDataError } from '@autotrade/engine/public';
import { ErrorCodes, type ErrorPayload } from '@autotrade/shared';
import { captureAppErrorServer } from '@/lib/error-tracking-server';

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

function isMarketDataAuthFailure(err: MarketDataError): boolean {
  return /\b(401|403)\b/.test(err.message);
}

export function handleError(err: unknown, context?: { route?: string }): NextResponse {
  if (err instanceof MarketDataError) {
    const authFailure = isMarketDataAuthFailure(err);
    const status = authFailure ? 401 : err.retryable ? 503 : 502;
    if (status >= 500) {
      captureAppErrorServer(ErrorCodes.INTERNAL, err, { route: context?.route });
    }
    const payload: ErrorPayload = {
      code: authFailure ? ErrorCodes.UNAUTHORIZED : ErrorCodes.INTERNAL,
      message: authFailure
        ? 'Market data credentials are invalid or expired.'
        : 'Market data is temporarily unavailable.',
    };
    return NextResponse.json({ error: payload }, { status });
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      captureAppErrorServer(err.code as typeof ErrorCodes[keyof typeof ErrorCodes], err, {
        route: context?.route,
        details: err.details,
      });
    }

    const payload: ErrorPayload = {
      code: err.code,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    };
    return NextResponse.json({ error: payload }, { status: err.statusCode });
  }

  const refId = captureAppErrorServer(ErrorCodes.INTERNAL, err, { route: context?.route });
  const payload: ErrorPayload = {
    code: ErrorCodes.INTERNAL,
    message: `An unexpected error occurred (ref: ${refId})`,
    refId,
  };
  return NextResponse.json({ error: payload }, { status: 500 });
}
