import type * as Sentry from '@sentry/nextjs';

export function enrichSentryEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  const ctx = event.contexts?.error as {
    code?: string;
    refId?: string;
    message?: string;
    route?: string;
    component?: string;
    digest?: string;
  } | undefined;
  const code = event.tags?.error_code ?? ctx?.code;
  if (typeof code === 'string' && !event.tags?.error_code) {
    event.tags = { ...event.tags, error_code: code };
  }
  if (ctx?.refId && !event.tags?.error_ref_id) {
    event.tags = { ...event.tags, error_ref_id: ctx.refId };
  }
  if (ctx?.route && !event.tags?.route) {
    event.tags = { ...event.tags, route: ctx.route };
  }
  if (ctx?.component && !event.tags?.component) {
    event.tags = { ...event.tags, component: ctx.component };
  }
  if (ctx?.message && event.message && !event.message.includes(ctx.message)) {
    const codeLabel = typeof code === 'string' ? code : 'ERROR';
    event.message = `[${codeLabel}] ${ctx.message}`;
  }
  if (event.exception?.values?.[0]) {
    const top = event.exception.values[0];
    if (ctx?.refId) {
      top.value = `${top.value ?? 'Error'} (ref: ${ctx.refId})`;
    }
    if (typeof code === 'string' && top.type && !top.type.includes(code)) {
      event.fingerprint = event.fingerprint ?? [code, ctx?.route ?? ctx?.component ?? 'app'];
    }
  }
  return event;
}
