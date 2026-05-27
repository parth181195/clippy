import { app, BrowserWindow, globalShortcut, Tray, Menu, nativeImage } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { Db } from './db.js';
import { registerIpc } from './ipc.js';
import { DEFAULT_SETTINGS, IPC } from './ipc-types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let db: Db | null = null;

const isDev = !app.isPackaged;
const VITE_URL = 'http://localhost:5173';

function loadSettingsFromDb() {
  if (!db) return DEFAULT_SETTINGS;
  const rows = db
    .raw()
    .prepare('SELECT key, value FROM settings')
    .all() as Array<{ key: string; value: string }>;
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    ...DEFAULT_SETTINGS,
    windowTransparent: (map.get('window_transparent') ?? String(DEFAULT_SETTINGS.windowTransparent)) === 'true',
    autostart: (map.get('autostart') ?? String(DEFAULT_SETTINGS.autostart)) === 'true',
    hotkeyPanel: map.get('hotkey_panel') ?? DEFAULT_SETTINGS.hotkeyPanel,
    hotkeyPasteLast: map.get('hotkey_paste_last') ?? DEFAULT_SETTINGS.hotkeyPasteLast,
    hotkeyIncognito: map.get('hotkey_incognito') ?? DEFAULT_SETTINGS.hotkeyIncognito,
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
  // Try a bundled icon; fall back to an empty image so the tray still appears.
  const iconPath = join(process.cwd(), 'desktop', 'assets', 'icons', 'tray.png');
  const icon = existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  tray = new Tray(icon);
  const menu = Menu.buildFromTemplate([
    { label: 'Show panel', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { label: 'Hide panel', click: () => mainWindow?.hide() },
    { type: 'separator' },
    { label: 'Quit Clippy', click: () => { app.quit(); } },
  ]);
  tray.setToolTip('Clippy');
  tray.setContextMenu(menu);
  tray.on('click', () => toggleWindow());
}

async function pasteById(_id: number, _shiftForTerminal: boolean): Promise<void> {
  // Stub for now — wired in the paste.ts port (next batch).
  console.log('[paste] stub: id', _id, 'shift', _shiftForTerminal);
}

app.whenReady().then(() => {
  db = Db.openDefault();
  registerIpc({
    db,
    onPaste: pasteById,
    onHidePanel: () => mainWindow?.hide(),
    onShowPanel: () => { mainWindow?.show(); mainWindow?.focus(); },
    onTogglePanel: toggleWindow,
  });

  const settings = loadSettingsFromDb();
  if (settings.autostart) installAutostart();

  createWindow();
  createTray();

  const reg = (chord: string, fn: () => void) => {
    try {
      const ok = globalShortcut.register(chord, fn);
      if (!ok) console.warn(`failed to register shortcut: ${chord}`);
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
    if (row) {
      pasteById(row.id, false).catch((e) => console.warn('paste-last failed', e));
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// Keep app alive when all windows are closed (clipboard managers run in tray).
app.on('window-all-closed', (e: Electron.Event) => {
  e.preventDefault();
});
