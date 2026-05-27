// Clippy GNOME shell extension — v1.
// Adds a top-bar indicator that toggles the Clippy electron panel via D-Bus.

import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import St from 'gi://St';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';

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
      icon_name: 'edit-paste-symbolic',
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

export default class ClippyExtension extends Extension {
  enable() {
    this._indicator = new ClippyIndicator(this);
    Main.panel.addToStatusArea(this.uuid, this._indicator);
  }

  disable() {
    this._indicator?.destroy();
    this._indicator = null;
  }
}
