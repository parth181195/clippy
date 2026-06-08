import { app } from 'electron';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Drop a .desktop file in ~/.config/autostart so Clippy launches on login.
 * Idempotent; called whenever the user toggles the autostart setting.
 */
export function installAutostart(): void {
  const dir = join(homedir(), '.config', 'autostart');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'clippy.desktop');
  // electron binary needs the app dir as its first arg; previous version
  // omitted it which meant the autostart entry silently failed to load
  // anything. Also pass the Wayland positioning flags so the panel
  // shows up where we expect.
  const electronBin = process.argv0;
  const appDir = app.getAppPath();
  const iconPath = join(appDir, 'assets', 'icons', 'icon.png');
  const exec = [
    electronBin,
    appDir,
    '--no-sandbox',
    '--disable-gpu-sandbox',
    '--ozone-platform-hint=x11',
    '--hidden',
  ].map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ');
  const content = `[Desktop Entry]
Type=Application
Name=Clippy
Comment=LAN clipboard manager
Exec=${exec}
Icon=${iconPath}
X-GNOME-Autostart-enabled=true
Terminal=false
NoDisplay=false
`;
  writeFileSync(file, content, { mode: 0o644 });
}
