// Clippy GNOME shell extension — v1.
// Adds a top-bar indicator that toggles the Clippy electron panel via D-Bus.

import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import St from 'gi://St';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';

import Shell from 'gi://Shell';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const CLIPPY_DBUS_NAME = 'io.clippy.App';
const CLIPPY_DBUS_PATH = '/io/clippy/App';
const CLIPPY_DBUS_IFACE = 'io.clippy.App';

const ClippyIndicator = GObject.registerClass(
class ClippyIndicator extends PanelMenu.Button {
  _init(extension) {
    super._init(0.0, 'Clippy');
    this._extension = extension;

    const icon = new St.Icon({
      gicon: Gio.icon_new_for_string(`${extension.path}/icons/clippy-symbolic.svg`),
      style_class: 'system-status-icon',
    });
    this.add_child(icon);

    // Popup actions
    const togglePanel = new PopupMenu.PopupMenuItem('Toggle Clippy panel');
    togglePanel.connect('activate', () => this._dbusCall('TogglePanel'));
    this.menu.addMenuItem(togglePanel);

    const pasteLast = new PopupMenu.PopupMenuItem('Paste last clip');
    pasteLast.connect('activate', () => this._dbusCall('PasteLast'));
    this.menu.addMenuItem(pasteLast);

    const incognito = new PopupMenu.PopupMenuItem('Toggle incognito');
    incognito.connect('activate', () => this._dbusCall('ToggleIncognito'));
    this.menu.addMenuItem(incognito);

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    const status = new PopupMenu.PopupMenuItem('Status: unknown', { reactive: false });
    this._statusItem = status;
    this.menu.addMenuItem(status);

    // Click on the indicator itself (not the popup) → toggle panel directly.
    this.connect('button-press-event', (_actor, event) => {
      if (event.get_button() === Clutter.BUTTON_PRIMARY) {
        this._dbusCall('TogglePanel');
        return Clutter.EVENT_STOP;
      }
      return Clutter.EVENT_PROPAGATE;
    });

    // Periodically refresh status from D-Bus (best effort).
    this._statusTimer = setInterval(() => this._refreshStatus(), 5000);
    this._refreshStatus();
  }

  _dbusCall(method) {
    try {
      const bus = Gio.DBus.session;
      bus.call(
        CLIPPY_DBUS_NAME,
        CLIPPY_DBUS_PATH,
        CLIPPY_DBUS_IFACE,
        method,
        null,
        null,
        Gio.DBusCallFlags.NONE,
        -1,
        null,
        (b, res) => {
          try { b.call_finish(res); } catch (e) {
            log(`[clippy-ext] ${method} failed: ${e.message}`);
          }
        }
      );
    } catch (e) {
      log(`[clippy-ext] D-Bus error: ${e.message}`);
    }
  }

  _refreshStatus() {
    const bus = Gio.DBus.session;
    bus.call(
      'org.freedesktop.DBus',
      '/org/freedesktop/DBus',
      'org.freedesktop.DBus',
      'NameHasOwner',
      new GLib.Variant('(s)', [CLIPPY_DBUS_NAME]),
      new GLib.VariantType('(b)'),
      Gio.DBusCallFlags.NONE,
      1000,
      null,
      (b, res) => {
        try {
          const [hasOwner] = b.call_finish(res).deep_unpack();
          this._statusItem.label.text = hasOwner ? 'Status: connected' : 'Status: Clippy not running';
        } catch (e) {
          this._statusItem.label.text = 'Status: unavailable';
        }
      }
    );
  }

  destroy() {
    if (this._statusTimer) {
      clearInterval(this._statusTimer);
      this._statusTimer = null;
    }
    super.destroy();
  }
});

// Pushes the currently-focused app id to Clippy via D-Bus on every focus change.
// This is the Wayland-friendly source-app capture path (xdotool can't see
// Wayland windows). Best-effort: dropped silently if Clippy isn't running.
class FocusedAppPusher {
  constructor() {
    const tracker = Shell.WindowTracker.get_default();
    this._tracker = tracker;
    this._lastAppId = '';
    this._focusHandler = tracker.connect('notify::focus-app', () => this._onFocusChanged());
    this._onFocusChanged();
  }

  _onFocusChanged() {
    const app = this._tracker.focus_app;
    const id = app ? (app.get_id() || '').replace(/\.desktop$/, '') : '';
    if (id === this._lastAppId) return;
    this._lastAppId = id;
    Gio.DBus.session.call(
      CLIPPY_DBUS_NAME, CLIPPY_DBUS_PATH, CLIPPY_DBUS_IFACE,
      'SetFocusedApp',
      new GLib.Variant('(s)', [id]),
      null, Gio.DBusCallFlags.NONE, 1000, null,
      (b, res) => { try { b.call_finish(res); } catch (_) {} }
    );
  }

  destroy() {
    if (this._focusHandler && this._tracker) {
      this._tracker.disconnect(this._focusHandler);
      this._focusHandler = null;
    }
  }
}

export default class ClippyExtension extends Extension {
  enable() {
    this._indicator = new ClippyIndicator(this);
    Main.panel.addToStatusArea(this.uuid, this._indicator);
    this._focusPusher = new FocusedAppPusher();
  }

  disable() {
    this._focusPusher?.destroy();
    this._focusPusher = null;
    this._indicator?.destroy();
    this._indicator = null;
  }
}
