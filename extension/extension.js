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

// The extension exposes its OWN D-Bus service so the desktop can synthesize
// input from within gnome-shell — the Shell process has direct Wayland input
// access, so no RemoteDesktop portal prompt fires (which the ydotool /
// wtype fallbacks would otherwise trigger on every paste).
const SHELL_DBUS_NAME = 'io.clippy.Shell';
const SHELL_DBUS_PATH = '/io/clippy/Shell';
const SHELL_INTROSPECTION_XML = `
<node>
  <interface name="io.clippy.Shell">
    <method name="PasteChord">
      <arg type="b" direction="in" name="shifted"/>
    </method>
  </interface>
</node>`;

const ClippyIndicator = GObject.registerClass(
class ClippyIndicator extends PanelMenu.Button {
  _init(extension) {
    super._init(0.0, 'Clippy');
    this._extension = extension;

    const icon = new St.Icon({
      gicon: Gio.icon_new_for_string(`${extension.path}/icons/clippy-symbolic.png`),
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

// D-Bus service the desktop calls to synthesize Ctrl+V (or Ctrl+Shift+V) from
// inside gnome-shell. Uses Clutter's virtual input device — Wayland-native,
// no portal prompt. The desktop writes the target text to the system
// clipboard first, then invokes PasteChord to deliver the paste keystroke.
class ClippyShellService {
  constructor() {
    this._exported = null;
    this._nameId = 0;
    try {
      this._exported = Gio.DBusExportedObject.wrapJSObject(SHELL_INTROSPECTION_XML, this);
      this._exported.export(Gio.DBus.session, SHELL_DBUS_PATH);
      this._nameId = Gio.bus_own_name(
        Gio.BusType.SESSION,
        SHELL_DBUS_NAME,
        Gio.BusNameOwnerFlags.NONE,
        null,
        null,
        null,
      );
      log('[clippy-ext] shell-svc exported at io.clippy.Shell');
    } catch (e) {
      log(`[clippy-ext] shell-svc setup failed: ${e.message}`);
    }
  }

  PasteChord(shifted) {
    try {
      const backend = Clutter.get_default_backend();
      const seat = backend.get_default_seat();
      const kbd = seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
      const t = () => Clutter.CURRENT_TIME;
      kbd.notify_keyval(t(), Clutter.KEY_Control_L, Clutter.KeyState.PRESSED);
      if (shifted) kbd.notify_keyval(t(), Clutter.KEY_Shift_L, Clutter.KeyState.PRESSED);
      kbd.notify_keyval(t(), Clutter.KEY_v, Clutter.KeyState.PRESSED);
      kbd.notify_keyval(t(), Clutter.KEY_v, Clutter.KeyState.RELEASED);
      if (shifted) kbd.notify_keyval(t(), Clutter.KEY_Shift_L, Clutter.KeyState.RELEASED);
      kbd.notify_keyval(t(), Clutter.KEY_Control_L, Clutter.KeyState.RELEASED);
    } catch (e) {
      log(`[clippy-ext] PasteChord failed: ${e.message}`);
    }
  }

  destroy() {
    if (this._nameId) {
      Gio.bus_unown_name(this._nameId);
      this._nameId = 0;
    }
    if (this._exported) {
      try { this._exported.unexport(); } catch (_) {}
      this._exported = null;
    }
  }
}

export default class ClippyExtension extends Extension {
  enable() {
    this._indicator = new ClippyIndicator(this);
    Main.panel.addToStatusArea(this.uuid, this._indicator);
    this._focusPusher = new FocusedAppPusher();
    this._shellSvc = new ClippyShellService();
  }

  disable() {
    this._shellSvc?.destroy();
    this._shellSvc = null;
    this._focusPusher?.destroy();
    this._focusPusher = null;
    this._indicator?.destroy();
    this._indicator = null;
  }
}
