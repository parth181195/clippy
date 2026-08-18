import { app, BrowserWindow, globalShortcut, Tray, Menu, nativeImage } from 'electron';
import { join } from 'node:path';
import { appendFileSync, existsSync } from 'node:fs';
import { Db } from './db';
import { registerIpc } from './ipc';
import { DEFAULT_SETTINGS, IPC, type ContentType } from './ipc-types';
import { startPolling } from './clipboard-poll';
import { makeHandler } from './pipeline';
import { Notifier } from './notifications';
import { Incognito } from './incognito';
import { SyncService } from './sync/sync-service';
import { initSentryMain, setReportingEnabled } from './sentry';
import { getDeviceIdentity } from './device-identity';
import { purgeStale as purgeOutboxStale } from './sync/outbox';
import { getPlatformAdapter, type SoundPlayer } from './platform';

const platform = getPlatformAdapter();

// Initialize crash/error reporting as early as possible (gated at runtime by
// the user's `errorReporting` setting once the DB loads).
initSentryMain(true);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let db: Db | null = null;
let incognito: Incognito | null = null;
let sound: SoundPlayer | null = null;
let notifier: Notifier | null = null;
let syncService: SyncService | null = null;

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
    hotkeyPanel: map.get('hotkey_panel') ?? platform.defaultHotkeys.panel,
    hotkeyPasteLast: map.get('hotkey_paste_last') ?? platform.defaultHotkeys.pasteLast,
    hotkeyIncognito: map.get('hotkey_incognito') ?? platform.defaultHotkeys.incognito,
    historySize: parseInt(map.get('history_size') ?? '', 10) || DEFAULT_SETTINGS.historySize,
    pollingMs: parseInt(map.get('polling_ms') ?? '', 10) || DEFAULT_SETTINGS.pollingMs,
    soundOnCopy: (map.get('sound_on_copy') ?? String(DEFAULT_SETTINGS.soundOnCopy)) === 'true',
    notificationsOnCopy:
      (map.get('notifications_on_copy') ?? String(DEFAULT_SETTINGS.notificationsOnCopy)) === 'true',
    incognitoAutoDisableSecs:
      parseInt(map.get('incognito_auto_disable_secs') ?? '', 10) ||
      DEFAULT_SETTINGS.incognitoAutoDisableSecs,
    errorReporting:
      (map.get('error_reporting') ?? String(DEFAULT_SETTINGS.errorReporting)) === 'true',
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
    icon: join(process.cwd(), 'assets', 'icons', 'icon.png'),
    frame: false,
    transparent: settings.windowTransparent,
    backgroundColor: settings.windowTransparent ? '#00000000' : '#0E0E15',
    resizable: false,
    skipTaskbar: false,
    alwaysOnTop: false,
    show: !process.argv.includes('--hidden'),
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

// Known terminal emulator app IDs / window names — we auto-force Ctrl+Shift+V
// when any of these has focus at paste time. Users pressing plain Enter on a
// history row shouldn't have to remember Shift+Enter for terminals.
const TERMINAL_APPS = new Set([
  'org.gnome.terminal',
  'gnome-terminal-server',
  'gnome-terminal',
  'org.gnome.console',
  'kgx', // GNOME Console binary name
  'kitty',
  'alacritty',
  'wezterm',
  'org.wezfurlong.wezterm',
  'terminator',
  'tilix',
  'com.gexperts.tilix',
  'konsole',
  'org.kde.konsole',
  'xterm',
  'urxvt',
  'foot',
  'org.contourterminal.contour',
  'com.mitchellh.ghostty',
  'ghostty',
]);

function shouldForceShiftedPaste(): boolean {
  const app = (platform.getFocusedApp() ?? '').toLowerCase();
  if (!app) return false;
  if (TERMINAL_APPS.has(app)) return true;
  // Substring safety net for window-title fallbacks (e.g. "user@host: ~" from xdotool).
  return app.includes('terminal') || app.includes('console');
}

// Paste several text-shaped clips at once, joined by newlines, in the given
// order. Non-text clips (image/file) are skipped. Used by multi-select.
async function pasteManyById(ids: number[], shiftForTerminal: boolean): Promise<void> {
  if (!db || ids.length === 0) return;
  const parts: string[] = [];
  for (const id of ids) {
    const row = db.raw()
      .prepare('SELECT content, mime FROM clips WHERE id = ?')
      .get(id) as { content: Buffer; mime: string } | undefined;
    if (row && row.mime.startsWith('text/')) parts.push(row.content.toString('utf8'));
  }
  if (parts.length === 0) return;
  mainWindow?.hide();
  await new Promise((r) => setTimeout(r, 50));
  const shift = shiftForTerminal || shouldForceShiftedPaste();
  await platform.paste(Buffer.from(parts.join('\n'), 'utf8'), 'text/plain', shift);
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
  const shift = shiftForTerminal || shouldForceShiftedPaste();
  await platform.paste(row.content, row.mime, shift);
}

// Launch the system screen color picker, store the result as a color clip,
// and notify the renderer. Returns the picked hex or null.
async function doPickColor(): Promise<string | null> {
  if (!db) return null;
  const hex = await platform.pickColor();
  if (!hex) return null;
  const { id, wasNew } = db.insertClip(
    'color',
    Buffer.from(hex, 'utf8'),
    'text/plain',
    hex,
    'color picker',
    Date.now()
  );
  if (!wasNew) {
    db.raw().prepare('UPDATE clips SET created_at = ? WHERE id = ?').run(Date.now(), id);
  }
  mainWindow?.webContents.send(IPC.EVT_CLIP_NEW, id);
  sound?.play();
  return hex;
}

app.whenReady().then(() => {
  db = Db.openDefault();
  const settings = loadSettingsFromDb();
  setReportingEnabled(settings.errorReporting);

  // Ensure this desktop has an ed25519 identity (lazy-generates on first run).
  // Awaiting this guarantees later sync code can sign HELLOs synchronously.
  getDeviceIdentity(db).catch((e) => console.warn('device-identity init failed', e));
  // Drop outbox entries older than 24 h on every cold start (PRD §9 / D8).
  try { purgeOutboxStale(db); } catch (e) { console.warn('outbox purge failed', e); }

  sound = platform.createSoundPlayer(settings.soundOnCopy);
  notifier = new Notifier(settings.notificationsOnCopy);

  incognito = new Incognito(settings.incognitoAutoDisableSecs, (on) => {
    mainWindow?.webContents.send(IPC.EVT_INCOGNITO_CHANGED, on);
  });

  // Sync service must exist before IPC + pipeline so the pairing handlers
  // and the clipboard-pipeline hook can talk to it.
  syncService = new SyncService({
    db,
    isOutgoingEnabled: () => loadSettingsFromDb().autoSyncOutgoing,
    isIncomingEnabled: () => loadSettingsFromDb().autoSyncIncoming,
    onConnStateChange: (state, deviceName) => {
      mainWindow?.webContents.send(IPC.EVT_CONN_STATE, { state, deviceName });
    },
    onRemoteClipInserted: (id) => {
      mainWindow?.webContents.send(IPC.EVT_CLIP_NEW, id);
    },
    onTransferProgress: (p) => {
      mainWindow?.webContents.send(IPC.EVT_TRANSFER_PROGRESS, p);
    },
  });
  syncService.start().catch((e) => console.warn('sync start failed', e));

  registerIpc({
    db,
    onPaste: pasteById,
    onPasteMany: pasteManyById,
    onHidePanel: () => mainWindow?.hide(),
    onShowPanel: () => { mainWindow?.show(); mainWindow?.focus(); },
    onTogglePanel: toggleWindow,
    onSettingsSaved: (next) => {
      platform.reinstallShellHotkeys?.({
        panel: next.hotkeyPanel,
        pasteLast: next.hotkeyPasteLast,
        incognito: next.hotkeyIncognito,
      });
      sound?.setEnabled(next.soundOnCopy);
      notifier?.setEnabled(next.notificationsOnCopy);
      setReportingEnabled(next.errorReporting);
    },
    onPairingBegin: async (deviceName) => {
      const r = await syncService!.beginPairing(deviceName);
      return { qrSvg: r.qrSvg, shortCode: r.shortCode };
    },
    onPairingCancel: () => syncService?.cancelPairing(),
    onUnpair: async () => { await syncService?.unpair(); },
    onPairingState: () => ({
      state: syncService?.state_() ?? 'unpaired',
      deviceName: syncService?.pairedDeviceName() ?? null,
    }),
    onSendClipToPeer: async (clipId) => (await syncService?.sendClipToPeer(clipId)) ?? null,
    onSendClipToDevice: async (clipId, deviceId) => {
      await syncService?.sendClipToDevice(clipId, deviceId);
    },
    onListSyncDevices: async () => syncService?.listDevices() ?? [],
    onPickColor: () => doPickColor(),
    onSyncTheme: (mode, accent) => { void syncService?.sendTheme(mode, accent); },
  });

  if (settings.autostart) platform.installAutostart();
  createWindow();
  // Linux skips the Electron Tray — the GNOME shell extension is our
  // canonical panel presence, and a Tray would duplicate it (also renders
  // oddly via SNI on GNOME Wayland). Mac + Win own their menu-bar/tray
  // presence directly, so they create one.
  if (process.platform !== 'linux') createTray();

  // Wire clipboard polling pipeline
  const excludedApps = (
    db.raw().prepare('SELECT app_id FROM excluded_apps').all() as Array<{ app_id: string }>
  ).map((r) => r.app_id);
  const handle = makeHandler({
    db,
    excludedApps,
    historySize: settings.historySize,
    getFocusedApp: () => platform.getFocusedApp(),
    onNewClip: (id, ct) => {
      sound?.play();
      const row = db!
        .raw()
        .prepare('SELECT preview FROM clips WHERE id = ?')
        .get(id) as { preview: string } | undefined;
      notifier?.notifyCapture(ct as ContentType, row?.preview ?? '');
      mainWindow?.webContents.send(IPC.EVT_CLIP_NEW, id);
      // Forward to sync (silent text auto-sync to peer; files won't fire here)
      syncService?.onLocalClip(id, ct as ContentType);
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

  // Shell integration:
  //  - Linux: exposes io.clippy.App on the session bus so the GNOME extension's
  //    custom-keybindings can drive the panel (Mutter's portal-based global
  //    shortcuts are silently dropped on Wayland), then auto-installs the
  //    bundled extension. The adapter handles setFocusedAppFromShell internally.
  //  - Mac/Win: no-op (Electron globalShortcut covers the same ground).
  void platform.initShellIntegration?.({
    onToggle: () => toggleWindow(),
    onShow: () => { mainWindow?.show(); mainWindow?.focus(); },
    onHide: () => mainWindow?.hide(),
    onPasteLast: () => doPasteLast(),
    onToggleIncognito: () => incognito?.toggle(),
    onSetFocusedApp: () => {},
    onPickColor: () => { void doPickColor(); },
  });
  // Install / refresh OS-level hotkey bindings. Linux writes GNOME custom-
  // keybindings (idempotent on every startup, also re-called from the
  // saveSettings IPC handler when the user changes a chord). Mac/Win: no-op.
  platform.reinstallShellHotkeys?.({
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
