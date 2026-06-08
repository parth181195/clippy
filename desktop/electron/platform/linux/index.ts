/**
 * Linux PlatformAdapter implementation. Wraps the GNOME / D-Bus / xdotool /
 * canberra code that's lived in `desktop/electron/` since v0.1.
 *
 * Behavior is unchanged from the pre-refactor world — issue #1 is purely
 * structural. The Mac (#2) and Win (#3) adapters slot in alongside this one.
 */

import type {
  PlatformAdapter,
  ShellHotkeyChords,
  ShellIntegrationHandlers,
  SoundPlayer,
} from '..';
import { pasteToActive } from './paste';
import { SoundPlayer as LinuxSoundPlayer } from './sound';
import { currentFocusedApp, setFocusedAppFromShell } from './focused-app';
import { startDbusApp } from './dbus-app';
import { installAll as installGnomeShortcuts } from './gnome-shortcut';
import { pickColor } from './color-picker';
import { ensureGnomeExtension } from './gnome-extension';
import { installAutostart } from './autostart';

export const LinuxAdapter: PlatformAdapter = {
  paste(content, mime, shiftForTerminal) {
    return pasteToActive(content, mime, shiftForTerminal);
  },

  getFocusedApp() {
    return currentFocusedApp();
  },

  pickColor() {
    return pickColor();
  },

  createSoundPlayer(enabled: boolean): SoundPlayer {
    const inst = new LinuxSoundPlayer(enabled);
    return {
      play: () => inst.playCopy(),
      setEnabled: (v) => inst.setEnabled(v),
    };
  },

  installAutostart() {
    installAutostart();
  },

  async initShellIntegration(handlers: ShellIntegrationHandlers): Promise<void> {
    // D-Bus first so the GNOME extension can call us. Extension install can
    // happen in the background; failure is non-fatal (user can install the
    // extension manually).
    await startDbusApp({
      onToggle: handlers.onToggle,
      onShow: handlers.onShow,
      onHide: handlers.onHide,
      onPasteLast: handlers.onPasteLast,
      onToggleIncognito: handlers.onToggleIncognito,
      onSetFocusedApp: (appId) => {
        setFocusedAppFromShell(appId);
        handlers.onSetFocusedApp(appId);
      },
      onPickColor: handlers.onPickColor,
    });
    ensureGnomeExtension().catch((e) =>
      console.warn('gnome-ext setup failed', e),
    );
  },

  reinstallShellHotkeys(chords: ShellHotkeyChords): void {
    installGnomeShortcuts({
      panel: chords.panel,
      pasteLast: chords.pasteLast,
      incognito: chords.incognito,
    });
  },
};
