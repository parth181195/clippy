import { app, BrowserWindow, globalShortcut, Tray, Menu, nativeImage } from 'electron';
import { join } from 'node:path';
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { Db } from './db';
import { registerIpc } from './ipc';
import { DEFAULT_SETTINGS, IPC, type ContentType } from './ipc-types';
import { startPolling } from './clipboard-poll';
import { makeHandler } from './pipeline';
import { pasteToActive } from './paste';
import { SoundPlayer } from './sound';
import { Notifier } from './notifications';
import { Incognito } from './incognito';
import { currentFocusedApp } from './focused-app';
import { startDbusApp } from './dbus-app';
import { installAll as installGnomeShortcuts } from './gnome-shortcut';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let db: Db | null = null;
let incognito: Incognito | null = null;
let sound: SoundPlayer | null = null;
let notifier: Notifier | null = null;

const isDev = !app.isPackaged;
const VITE_URL = 'http://localhost:5174';

function loadSettingsFromDb() {
  if (!db) return DEFAULT_SETTINGS;
  const rows = db.raw().prepare('SELECT key, value FROM settings').all() as Array<{
    key: string;
    value: string;
  }>;
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    ...DEFAULT_SETTINGS,
    windowTransparent:
      (map.get('window_transparent') ?? String(DEFAULT_SETTINGS.windowTransparent)) === 'true',
    autostart: (map.get('autostart') ?? String(DEFAULT_SETTINGS.autostart)) === 'true',
    hotkeyPanel: map.get('hotkey_panel') ?? DEFAULT_SETTINGS.hotkeyPanel,
    hotkeyPasteLast: map.get('hotkey_paste_last') ?? DEFAULT_SETTINGS.hotkeyPasteLast,
    hotkeyIncognito: map.get('hotkey_incognito') ?? DEFAULT_SETTINGS.hotkeyIncognito,
    historySize: parseInt(map.get('history_size') ?? '', 10) || DEFAULT_SETTINGS.historySize,
    pollingMs: parseInt(map.get('polling_ms') ?? '', 10) || DEFAULT_SETTINGS.pollingMs,
    soundOnCopy: (map.get('sound_on_copy') ?? String(DEFAULT_SETTINGS.soundOnCopy)) === 'true',
    notificationsOnCopy:
      (map.get('notifications_on_copy') ?? String(DEFAULT_SETTINGS.notificationsOnCopy)) === 'true',
    incognitoAutoDisableSecs:
      parseInt(map.get('incognito_auto_disable_secs') ?? '', 10) ||
      DEFAULT_SETTINGS.incognitoAutoDisableSecs,
  };
}

function bottomAnchoredXY(width: number, height: number): { x: number; y: number } {
  const { screen } = require('electron') as typeof import('electron');
  const display = screen.getPrimaryDisplay();
  const { bounds } = display;
  // Use bounds (full physical screen), not workArea. The panel sits flush
  // against the bottom of the monitor (bottom corners squared).
  const result = {
    x: bounds.x + Math.round((bounds.width - width) / 2),
    y: bounds.y + bounds.height - height,
  };
  return result;
}

function createWindow() {
  const settings = loadSettingsFromDb();
  // Full-width like Pano (Clutter.ActorAlign.FILL on the x-axis); the panel
  // spans the entire monitor width and sits flush against the bottom.
  const { screen } = require('electron') as typeof import('electron');
  const display = screen.getPrimaryDisplay();
  const W = display.bounds.width;
  const H = 380; // bumped from design's 340 so cards (240) + body padding fit without clipping
  const { x, y } = bottomAnchoredXY(W, H);
  mainWindow = new BrowserWindow({
    x, y,
    width: W,
    height: H,
    frame: false,
    transparent: settings.windowTransparent,
    backgroundColor: settings.windowTransparent ? '#00000000' : '#0E0E15',
    resizable: false,
    skipTaskbar: false,
    alwaysOnTop: false,
    show: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });
  if (isDev) mainWindow.loadURL(VITE_URL);
  else mainWindow.loadFile(join(__dirname, '..', 'dist', 'index.html'));

  const reanchor = () => {
    if (!mainWindow) return;
    try {
      const [actualW, actualH] = mainWindow.getSize();
      const targetW = W;
      const targetH = H;
      const p = bottomAnchoredXY(targetW, targetH);
      // setBounds forces both size + position in one call; setPosition alone
      // sometimes lets the WM keep an oversized width on first show.
      mainWindow.setBounds({ x: p.x, y: p.y, width: targetW, height: targetH });
      const fs = require('node:fs') as typeof import('node:fs');
      const path = require('node:path') as typeof import('node:path');
      fs.appendFileSync(
        path.join(app.getPath('userData'), 'clippy', 'dbus.log'),
        `[${new Date().toISOString()}] [reanchor] actual=${actualW}x${actualH} target=${targetW}x${targetH} → bounds (${p.x},${p.y}) ${targetW}x${targetH}\n`
      );
    } catch (e) {
      console.warn('reanchor failed', e);
    }
  };

  // Re-apply on ready-to-show in case Wayland positioned it elsewhere first.
  mainWindow.once('ready-to-show', reanchor);
  // Re-anchor every time we show the window so it doesn't drift to wherever
  // the compositor last placed it.
  mainWindow.on('show', reanchor);

  // Pano-style click-outside-to-close: when the window loses focus, hide it.
  // (Implemented via blur event because Electron has no "click outside window"
  // event for a frameless top-level window.)
  mainWindow.on('blur', () => {
    if (mainWindow && mainWindow.isVisible()) mainWindow.hide();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function toggleWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isVisible() && mainWindow.isFocused()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

function installAutostart() {
  const dir = join(homedir(), '.config', 'autostart');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'clippy.desktop');
  if (existsSync(file)) return;
  const exec = process.argv0;
  const content = `[Desktop Entry]
Type=Application
Name=Clippy
Comment=LAN clipboard manager
Exec=${exec} --hidden
X-GNOME-Autostart-enabled=true
Terminal=false
`;
  writeFileSync(file, content, { mode: 0o644 });
}

function createTray() {
  const iconPath = join(process.cwd(), 'assets', 'icons', 'tray.png');
  const icon = existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty();
  tray = new Tray(icon);
  const menu = Menu.buildFromTemplate([
    {
      label: 'Show panel',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { label: 'Hide panel', click: () => mainWindow?.hide() },
    { type: 'separator' },
    {
      label: 'Quit Clippy',
      click: () => {
        app.quit();
      },
    },
  ]);
  tray.setToolTip('Clippy');
  tray.setContextMenu(menu);
  tray.on('click', () => toggleWindow());
}

async function pasteById(id: number, shiftForTerminal: boolean): Promise<void> {
  if (!db) return;
  const row = db
    .raw()
    .prepare('SELECT content, mime FROM clips WHERE id = ?')
    .get(id) as { content: Buffer; mime: string } | undefined;
  if (!row) return;
  // Hide window so the synthesised Ctrl+V lands in the previously-focused app.
  mainWindow?.hide();
  await new Promise((r) => setTimeout(r, 50));
  await pasteToActive(row.content, row.mime, shiftForTerminal);
}

app.whenReady().then(() => {
  db = Db.openDefault();
  const settings = loadSettingsFromDb();

  sound = new SoundPlayer(settings.soundOnCopy);
  notifier = new Notifier(settings.notificationsOnCopy);

  incognito = new Incognito(settings.incognitoAutoDisableSecs, (on) => {
    mainWindow?.webContents.send(IPC.EVT_INCOGNITO_CHANGED, on);
  });

  registerIpc({
    db,
    onPaste: pasteById,
    onHidePanel: () => mainWindow?.hide(),
    onShowPanel: () => { mainWindow?.show(); mainWindow?.focus(); },
    onTogglePanel: toggleWindow,
    onSettingsSaved: (next) => {
      // Re-install GNOME custom keybindings whenever the user changes a chord
      // in Settings → Hotkeys. Idempotent; only the changed binding actually
      // gets a different GNOME binding string.
      installGnomeShortcuts({
        panel: next.hotkeyPanel,
        pasteLast: next.hotkeyPasteLast,
        incognito: next.hotkeyIncognito,
      });
      // Live-toggle sound & notifications without restart
      sound?.setEnabled(next.soundOnCopy);
      notifier?.setEnabled(next.notificationsOnCopy);
    },
  });

  if (settings.autostart) installAutostart();
  createWindow();
  createTray();

  // Wire clipboard polling pipeline
  const excludedApps = (
    db.raw().prepare('SELECT app_id FROM excluded_apps').all() as Array<{ app_id: string }>
  ).map((r) => r.app_id);
  const handle = makeHandler({
    db,
    excludedApps,
    historySize: settings.historySize,
    getFocusedApp: currentFocusedApp,
    onNewClip: (id, ct) => {
      sound?.playCopy();
      const row = db!
        .raw()
        .prepare('SELECT preview FROM clips WHERE id = ?')
        .get(id) as { preview: string } | undefined;
      notifier?.notifyCapture(ct as ContentType, row?.preview ?? '');
      mainWindow?.webContents.send(IPC.EVT_CLIP_NEW, id);
    },
  });
  startPolling(settings.pollingMs, () => incognito?.isActive() ?? false, handle);

  // Hotkeys — log to a file in userData so we can diagnose Wayland registration
  // failures regardless of how Electron was launched (npx, npm, .desktop, etc.).
  const logPath = join(app.getPath('userData'), 'clippy', 'hotkeys.log');
  const logHk = (msg: string) => {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    try {
      appendFileSync(logPath, line);
    } catch {}
    console.log(line.trim());
  };
  logHk(`startup: hotkeyPanel=${settings.hotkeyPanel} pasteLast=${settings.hotkeyPasteLast} incognito=${settings.hotkeyIncognito}`);
  const reg = (chord: string, fn: () => void, label: string) => {
    try {
      const ok = globalShortcut.register(chord, () => { logHk(`fired: ${label} (${chord})`); fn(); });
      logHk(`register ${label} ${chord}: ${ok ? 'OK' : 'FAILED'}`);
    } catch (e) {
      logHk(`register ${label} ${chord} threw: ${(e as Error).message}`);
    }
  };
  reg(settings.hotkeyPanel, toggleWindow, 'panel');
  const doPasteLast = () => {
    if (!db) return;
    const row = db.raw().prepare('SELECT id FROM clips ORDER BY created_at DESC LIMIT 1')
      .get() as { id: number } | undefined;
    if (row) pasteById(row.id, false).catch((e) => logHk('paste-last failed: ' + e));
  };
  reg(settings.hotkeyPasteLast, doPasteLast, 'paste-last');
  reg(settings.hotkeyIncognito, () => {
    const on = incognito?.toggle();
    logHk('incognito: ' + (on ? 'ON' : 'OFF'));
  }, 'incognito');

  // Expose io.clippy.App on the session bus so gdbus can drive the panel.
  // Reliable Wayland hotkey path: a GNOME custom-keybinding that calls our
  // D-Bus method (Mutter's portal-based global shortcuts are silently dropped).
  void startDbusApp({
    onToggle: () => toggleWindow(),
    onShow: () => { mainWindow?.show(); mainWindow?.focus(); },
    onHide: () => mainWindow?.hide(),
    onPasteLast: () => doPasteLast(),
    onToggleIncognito: () => incognito?.toggle(),
  });
  // Install / refresh all GNOME custom keybindings so user's hotkeys actually
  // fire on Wayland. Idempotent on every startup, and re-called from the
  // saveSettings IPC handler when the user changes a chord.
  installGnomeShortcuts({
    panel: settings.hotkeyPanel,
    pasteLast: settings.hotkeyPasteLast,
    incognito: settings.hotkeyIncognito,
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // Stay alive in tray.
});
