import { NextResponse } from 'next/server';
import { AppError } from '@autotrade/engine/public';
import { ErrorCodes, type ErrorPayload } from '@autotrade/shared';
import { captureAppErrorServer } from '@/lib/error-tracking-server';

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function handleError(err: unknown, context?: { route?: string }): NextResponse {
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
