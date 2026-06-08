import dbus from 'dbus-next';
import { app, Notification } from 'electron';
import { cpSync, existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// One-install GNOME integration: the .deb bundles the extension; on first run we
// drop it into the per-user extensions dir and enable it live over the Shell's
// D-Bus (exactly what Extension Manager does — no logout). Notification is only
// a fallback if the live-enable doesn't take.

const UUID = 'clippy@io.clippy';
const ENABLED = 1; // org.gnome.Shell ExtensionState.ENABLED

/** Resolve the bundled extension dir by probing candidates (don't trust app.isPackaged). */
function bundledDir(): string | null {
  const candidates = [
    join(process.resourcesPath, 'gnome-extension'), // packaged extraResources
    join(app.getAppPath(), '..', 'extension'), // dev: getAppPath() = desktop/
    join(app.getAppPath(), '..', '..', 'extension'),
  ];
  for (const c of candidates) {
    try {
      if (existsSync(join(c, 'metadata.json'))) return c;
    } catch {}
  }
  return null;
}

function versionName(metaPath: string): string | null {
  try {
    return (JSON.parse(readFileSync(metaPath, 'utf8'))['version-name'] as string) ?? null;
  } catch {
    return null;
  }
}

/** Copy the bundled extension into ~/.local/share/... if missing/outdated. Returns true if present after. */
function installFiles(): boolean {
  const src = bundledDir();
  if (!src) {
    console.warn('[gnome-ext] bundled extension not found in any candidate path');
    return false;
  }
  const srcMeta = join(src, 'metadata.json');
  const dest = join(homedir(), '.local', 'share', 'gnome-shell', 'extensions', UUID);
  const destMeta = join(dest, 'metadata.json');
  if (!existsSync(destMeta) || versionName(destMeta) !== versionName(srcMeta)) {
    cpSync(src, dest, {
      recursive: true,
      filter: (s) => !/(?:^|\/)(Makefile|README\.md|clippy\.zip|\.git)(?:$|\/)/.test(s),
    });
    console.log('[gnome-ext] installed extension from', src, '→', dest);
  }
  return existsSync(destMeta);
}

async function getState(iface: dbus.ClientInterface): Promise<number | null> {
  try {
    const info = (await iface.GetExtensionInfo(UUID)) as Record<string, { value?: unknown }>;
    if (!info || Object.keys(info).length === 0) return null; // shell doesn't know it yet
    const st = info.state;
    const v = st && typeof st === 'object' && 'value' in st ? st.value : st;
    return v == null ? null : Number(v);
  } catch {
    return null;
  }
}

function notifyEnable(): void {
  try {
    new Notification({
      title: 'Enable the Clippy GNOME extension',
      body: 'Open Extension Manager and turn on “Clippy” for the tray icon and app-aware capture — no logout needed.',
    }).show();
  } catch {}
}

export async function ensureGnomeExtension(): Promise<void> {
  // GNOME-only feature.
  if (!(process.env.XDG_CURRENT_DESKTOP || '').toUpperCase().includes('GNOME')) return;

  let present = false;
  try {
    present = installFiles();
  } catch (e) {
    console.warn('[gnome-ext] copy failed', e);
  }
  if (!present) return;

  let iface: dbus.ClientInterface;
  try {
    const obj = await dbus.sessionBus().getProxyObject('org.gnome.Shell', '/org/gnome/Shell');
    iface = obj.getInterface('org.gnome.Shell.Extensions');
  } catch {
    notifyEnable(); // no Shell D-Bus (unusual) → let the user enable it manually
    return;
  }

  // Wait for the shell's file-monitor to register the freshly-copied dir, then enable.
  for (let i = 0; i < 10; i++) {
    const st = await getState(iface);
    if (st === ENABLED) return; // already on
    if (st !== null) {
      try {
        await iface.EnableExtension(UUID);
      } catch {}
      if ((await getState(iface)) === ENABLED) return;
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  notifyEnable();
}
