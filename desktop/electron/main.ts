import { app, BrowserWindow, globalShortcut, Tray, Menu, nativeImage } from 'electron';
import { join } from 'node:path';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
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

function createWindow() {
  const settings = loadSettingsFromDb();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 340,
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
    onShowPanel: () => {
      mainWindow?.show();
      mainWindow?.focus();
    },
    onTogglePanel: toggleWindow,
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

  // Hotkeys
  const reg = (chord: string, fn: () => void) => {
    try {
      if (!globalShortcut.register(chord, fn)) console.warn(`shortcut not registered: ${chord}`);
    } catch (e) {
      console.warn(`shortcut error: ${chord}`, e);
    }
  };
  reg(settings.hotkeyPanel, toggleWindow);
  reg(settings.hotkeyPasteLast, () => {
    if (!db) return;
    const row = db
      .raw()
      .prepare('SELECT id FROM clips ORDER BY created_at DESC LIMIT 1')
      .get() as { id: number } | undefined;
    if (row) pasteById(row.id, false).catch((e) => console.warn('paste-last failed', e));
  });
  reg(settings.hotkeyIncognito, () => {
    const on = incognito?.toggle();
    console.log('incognito:', on ? 'ON' : 'OFF');
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // Stay alive in tray.
});
