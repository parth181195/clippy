import * as Sentry from '@sentry/electron/renderer';

// Renderer-side init connects to the main-process Sentry SDK (no DSN needed
// here). The main process owns the DSN + the on/off gating via beforeSend, so
// renderer errors are captured and forwarded, then dropped when reporting is off.
export function initSentryRenderer(): void {
  Sentry.init({});
}
