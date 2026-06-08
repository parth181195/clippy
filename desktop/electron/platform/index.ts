/**
 * Platform abstraction (issue #1 / PRD §5).
 *
 * `main.ts` should never reach for `process.platform` or import an OS-specific
 * helper directly — it goes through `getPlatformAdapter()`. The adapter is a
 * plain object (not a class), so callers can destructure the methods they need.
 *
 * v0.2.x ships Linux only; macOS (#2) and Windows (#3) add their own files
 * under `platform/mac.ts` and `platform/win.ts` and slot in below.
 */

export type SoundPlayer = {
  /** Play the click-sound, if enabled. No-op when disabled. */
  play(): void;
  setEnabled(enabled: boolean): void;
};

export interface ShellHotkeyChords {
  panel: string;
  pasteLast: string;
  incognito: string;
}

/**
 * Hooks invoked when the OS shell (currently only the GNOME extension) fires
 * a panel-action or pushes a focused-app update. Mac/Win don't have a
 * shell-integration path — they'll leave `initShellIntegration` undefined.
 */
export interface ShellIntegrationHandlers {
  onToggle: () => void;
  onShow: () => void;
  onHide: () => void;
  onPasteLast: () => void;
  onToggleIncognito: () => void;
  onSetFocusedApp: (appId: string) => void;
  onPickColor: () => void;
}

export interface PlatformAdapter {
  /**
   * Per-OS hotkey defaults. Seeded into the settings table on first launch
   * when no row exists; the user can rebind from the Hotkeys screen after.
   *
   * Linux + Win use `Ctrl+Alt+Shift+V`-style chords; Mac uses `Cmd`-based
   * because that's what Mac users expect for global shortcuts.
   */
  defaultHotkeys: ShellHotkeyChords;

  /**
   * Inject text into the previously-focused window as keystrokes.
   * `mime` is needed because terminals want a shifted Ctrl+V for some
   * content and a raw key-by-key type for others.
   * Binary content (images, files) is not yet supported on any platform.
   */
  paste(content: Buffer, mime: string, shiftForTerminal: boolean): Promise<void>;

  /** Best-effort focused-window name. Sync; the clipboard poller calls it once per tick. */
  getFocusedApp(): string | null;

  /**
   * Native color-picker. Returns a `#rrggbb` hex string or `null` if the
   * user cancelled / the picker is unsupported on this OS.
   */
  pickColor(): Promise<string | null>;

  /** Create the per-app click-sound player. State (enabled flag) lives inside. */
  createSoundPlayer(enabled: boolean): SoundPlayer;

  /** Install the OS-level autostart entry (Linux: .desktop file; Mac/Win: setLoginItemSettings). */
  installAutostart(): void;

  /**
   * Optional shell integration:
   *  - Linux: starts D-Bus service + ensures the bundled GNOME extension is installed.
   *  - Mac/Win: not implemented; tray + Electron globalShortcut cover the same ground.
   */
  initShellIntegration?(handlers: ShellIntegrationHandlers): Promise<void>;

  /**
   * Re-install OS-level hotkey bindings after a settings save.
   * Linux writes GNOME custom-keybindings (Mutter ignores Electron's globalShortcut
   * on Wayland for some chords). Mac/Win don't need this — Electron's
   * globalShortcut.register works directly.
   */
  reinstallShellHotkeys?(chords: ShellHotkeyChords): void;
}

let _adapter: PlatformAdapter | null = null;

export function getPlatformAdapter(): PlatformAdapter {
  if (_adapter) return _adapter;
  switch (process.platform) {
    case 'linux': {
      // Deferred require so non-Linux bundles never load dbus-next etc.
      const { LinuxAdapter } = require('./linux') as typeof import('./linux');
      _adapter = LinuxAdapter;
      return _adapter;
    }
    case 'darwin': {
      const { MacAdapter } = require('./mac') as typeof import('./mac');
      _adapter = MacAdapter;
      return _adapter;
    }
    case 'win32': {
      const { WinAdapter } = require('./win') as typeof import('./win');
      _adapter = WinAdapter;
      return _adapter;
    }
    default:
      throw new Error(`Unsupported platform: ${process.platform}.`);
  }
}
