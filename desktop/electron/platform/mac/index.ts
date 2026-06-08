/**
 * macOS PlatformAdapter implementation (#2).
 *
 * Status: code lands here; live verification needs Mac hardware (DMG mount,
 * Accessibility prompt, paste-as-keystroke). Once #4 (the 3-OS CI workflow)
 * builds a DMG on `macos-latest`, we can iterate against a real artifact.
 */

import type {
  PlatformAdapter,
  ShellHotkeyChords,
  SoundPlayer,
} from '..';
import { pasteToActive } from './paste';
import { MacSoundPlayer } from './sound';
import { currentFocusedApp } from './focused-app';
import { installAutostart } from './autostart';

const DEFAULT_HOTKEYS: ShellHotkeyChords = {
  // Cmd-based, matching what every shipped Mac clipboard manager uses.
  panel: 'Cmd+Shift+V',
  pasteLast: 'Cmd+Alt+V',
  incognito: 'Cmd+Shift+I',
};

export const MacAdapter: PlatformAdapter = {
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
    const inst = new MacSoundPlayer(enabled);
    return {
      play: () => inst.play(),
      setEnabled: (v) => inst.setEnabled(v),
    };
  },

  installAutostart() {
    installAutostart();
  },

  // initShellIntegration / reinstallShellHotkeys: undefined on macOS — the
  // Electron globalShortcut + Tray cover the same UX as Linux's GNOME
  // extension + D-Bus accelerators path. No-op == omit.
};
