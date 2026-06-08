import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

/**
 * Register Clippy hotkeys as GNOME *custom* keyboard shortcuts that call
 * `io.clippy.App` D-Bus methods. This is the only reliable global-hotkey path
 * on GNOME Wayland for non-extension apps — Mutter's portal-based shortcuts
 * API silently fails. Same effective wiring as Pano (which registers via
 * shell-internal addKeybinding), just routed through gdbus.
 */

const BASE = '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/clippy-';
const SCHEMA_PARENT = 'org.gnome.settings-daemon.plugins.media-keys';
const SCHEMA_CUSTOM = 'org.gnome.settings-daemon.plugins.media-keys.custom-keybinding';

export type ShortcutAction = 'toggle' | 'paste-last' | 'toggle-incognito';

const ACTION_TO_DBUS: Record<ShortcutAction, string> = {
  'toggle': 'TogglePanel',
  'paste-last': 'PasteLast',
  'toggle-incognito': 'ToggleIncognito',
};

function pathFor(action: ShortcutAction): string {
  return `${BASE}${action}/`;
}

function log(msg: string) {
  try {
    appendFileSync(
      join(app.getPath('userData'), 'clippy', 'dbus.log'),
      `[${new Date().toISOString()}] [gnome-shortcut] ${msg}\n`
    );
  } catch {}
  console.log('[gnome-shortcut]', msg);
}

function gsettings(...args: string[]): string {
  return execFileSync('gsettings', args, { encoding: 'utf8' }).trim();
}

/** "Ctrl+Alt+Shift+V" → "<Control><Alt><Shift>v" */
function toGnomeBinding(accel: string): string {
  return accel
    .split('+')
    .map((p) => {
      const s = p.trim();
      if (/^(ctrl|control)$/i.test(s)) return '<Control>';
      if (/^(alt|option)$/i.test(s)) return '<Alt>';
      if (/^(shift)$/i.test(s)) return '<Shift>';
      if (/^(super|meta|cmd|command)$/i.test(s)) return '<Super>';
      return s.toLowerCase();
    })
    .join('');
}

function currentList(): string[] {
  try {
    const raw = gsettings('get', SCHEMA_PARENT, 'custom-keybindings');
    const m = raw.match(/'([^']+)'/g);
    return m ? m.map((s) => s.slice(1, -1)) : [];
  } catch { return []; }
}

function setList(paths: string[]): void {
  const arrStr = paths.length === 0 ? '@as []' : '[' + paths.map((p) => `'${p}'`).join(', ') + ']';
  gsettings('set', SCHEMA_PARENT, 'custom-keybindings', arrStr);
}

export function installShortcut(action: ShortcutAction, accel: string): boolean {
  try {
    const path = pathFor(action);
    const list = currentList();
    if (!list.includes(path)) {
      list.push(path);
      setList(list);
    }
    const dbusMethod = ACTION_TO_DBUS[action];
    gsettings('set', `${SCHEMA_CUSTOM}:${path}`, 'name', `Clippy: ${action}`);
    gsettings(
      'set',
      `${SCHEMA_CUSTOM}:${path}`,
      'command',
      `gdbus call --session --dest io.clippy.App --object-path /io/clippy/App --method io.clippy.App.${dbusMethod}`
    );
    gsettings('set', `${SCHEMA_CUSTOM}:${path}`, 'binding', toGnomeBinding(accel));
    log(`${action} → ${accel} (${toGnomeBinding(accel)}) → io.clippy.App.${dbusMethod}`);
    return true;
  } catch (e) {
    log(`install ${action} failed: ${(e as Error).message}`);
    return false;
  }
}

export function installAll(opts: {
  panel: string;
  pasteLast: string;
  incognito: string;
}): void {
  installShortcut('toggle', opts.panel);
  installShortcut('paste-last', opts.pasteLast);
  installShortcut('toggle-incognito', opts.incognito);
}

export function uninstallAll(): void {
  try {
    const ours = (['toggle', 'paste-last', 'toggle-incognito'] as ShortcutAction[]).map(pathFor);
    const remaining = currentList().filter((p) => !ours.includes(p));
    setList(remaining);
    log('uninstalled all');
  } catch {}
}
