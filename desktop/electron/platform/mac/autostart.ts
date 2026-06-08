import { app } from 'electron';

/**
 * Mac autostart via the standard LaunchAgent route. Electron's
 * `setLoginItemSettings` writes a LaunchAgent plist under
 * `~/Library/LaunchAgents/io.clippy.app.plist` (the appId from
 * electron-builder) — no manual plist authoring needed.
 *
 * Idempotent; safe to call on every setting toggle.
 */
export function installAutostart(): void {
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true,
    // Match the Linux .desktop entry's `--hidden` flag so Clippy starts
    // backgrounded with only its menu-bar item visible on login.
    args: ['--hidden'],
  });
}
