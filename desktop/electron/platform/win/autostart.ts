import { app } from 'electron';

/**
 * Windows autostart via Electron's `setLoginItemSettings`, which writes the
 * standard HKCU\Software\Microsoft\Windows\CurrentVersion\Run registry key
 * — no UAC prompt (user-scope only), no installer-time decision needed.
 *
 * Pairs with the NSIS installer's `perMachine: false` so everything stays
 * in the user's profile.
 */
export function installAutostart(): void {
  app.setLoginItemSettings({
    openAtLogin: true,
    args: ['--hidden'],
  });
}
