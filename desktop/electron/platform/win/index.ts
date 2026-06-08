/**
 * Windows PlatformAdapter implementation (#3).
 *
 * Status: code lands here; live verification needs a Windows runner (DMG-
 * equivalent NSIS install, paste-as-keystroke into real apps, focused-app
 * latency, mDNS without Bonjour Print Services). Once #4 (the 3-OS CI
 * workflow) builds an .exe on `windows-latest`, we iterate against the
 * artifact.
 *
 * Implementation notes — all v0.3 stopgaps; native-addon follow-up is filed:
 *   - paste: PowerShell SendKeys + clipboard stash/restore.
 *   - focused-app: PowerShell GetForegroundWindow via inline Add-Type
 *     (1 s cache to absorb the powershell.exe spawn cost).
 *   - sound: PowerShell SystemSounds.Asterisk → bundled OGG fallback.
 *   - autostart: setLoginItemSettings (HKCU Run key).
 */

import type {
  PlatformAdapter,
  ShellHotkeyChords,
  SoundPlayer,
} from '..';
import { pasteToActive } from './paste';
import { WinSoundPlayer } from './sound';
import { currentFocusedApp } from './focused-app';
import { installAutostart } from './autostart';

const DEFAULT_HOTKEYS: ShellHotkeyChords = {
  // Standard Windows clipboard-manager chords; matches Win+V's own UX.
  panel: 'Ctrl+Shift+V',
  pasteLast: 'Ctrl+Alt+V',
  incognito: 'Ctrl+Shift+I',
};

export const WinAdapter: PlatformAdapter = {
  defaultHotkeys: DEFAULT_HOTKEYS,

  paste(content, mime, shiftForTerminal) {
    return pasteToActive(content, mime, shiftForTerminal);
  },

  getFocusedApp() {
    return currentFocusedApp();
  },

  /**
   * Color picker is a Linux/Wayland-only feature for v0.3 (PRD §2 non-goals).
   * Returning null lets the IPC handler no-op cleanly.
   */
  async pickColor(): Promise<string | null> {
    return null;
  },

  createSoundPlayer(enabled: boolean): SoundPlayer {
    const inst = new WinSoundPlayer(enabled);
    return {
      play: () => inst.play(),
      setEnabled: (v) => inst.setEnabled(v),
    };
  },

  installAutostart() {
    installAutostart();
  },

  // initShellIntegration / reinstallShellHotkeys: undefined on Windows — the
  // Electron globalShortcut + Tray cover the same UX as Linux's GNOME
  // extension + D-Bus accelerators path. No-op == omit.
};
