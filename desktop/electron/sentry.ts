import * as Sentry from '@sentry/electron/main';
import { app } from 'electron';

// Sentry DSN is a write-only ingest key — safe to embed in the client.
// Override per-build with SENTRY_DSN if needed.
const DSN =
  process.env.SENTRY_DSN ??
  'https://f59125871e02e25184c68539abe30149@o4511466706567168.ingest.de.sentry.io/4511466713514064';

// Live flag mirrored from the user's `errorReporting` setting. `beforeSend`
// drops every event when off, so the toggle takes effect without a restart.
let reportingEnabled = true;

export function initSentryMain(enabled: boolean): void {
  reportingEnabled = enabled;
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    release: `clippy@${app.getVersion()}`,
    environment: app.isPackaged ? 'production' : 'development',
    beforeSend: (event) => (reportingEnabled ? event : null),
  });
}

export function setReportingEnabled(enabled: boolean): void {
  reportingEnabled = enabled;
}
