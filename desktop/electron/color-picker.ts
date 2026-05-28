import dbus from 'dbus-next';

const PORTAL = 'org.freedesktop.portal.Desktop';
const PORTAL_PATH = '/org/freedesktop/portal/desktop';
const SCREENSHOT_IFACE = 'org.freedesktop.portal.Screenshot';
const REQUEST_IFACE = 'org.freedesktop.portal.Request';

function toHex(c: number): string {
  // Portal returns each channel as a 0..1 double.
  const v = Math.max(0, Math.min(255, Math.round(c * 255)));
  return v.toString(16).padStart(2, '0');
}

/**
 * Launch the system screen color picker (XDG portal). On GNOME/Wayland this
 * shows Mutter's native pixel loupe. Resolves to a #rrggbb hex string, or
 * null if the user cancelled / the portal is unavailable.
 */
export async function pickColor(timeoutMs = 60_000): Promise<string | null> {
  try {
    const bus = dbus.sessionBus();
    const obj = await bus.getProxyObject(PORTAL, PORTAL_PATH);
    const screenshot = obj.getInterface(SCREENSHOT_IFACE);

    // PickColor returns the Request object path. We subscribe to its Response
    // signal right after — safe from the race because the portal only emits
    // Response once the user has actually picked a pixel (seconds later).
    const handlePath = (await screenshot.PickColor('', {})) as string;
    const reqObj = await bus.getProxyObject(PORTAL, handlePath);
    const reqIface = reqObj.getInterface(REQUEST_IFACE);

    return await new Promise<string | null>((resolve) => {
      let settled = false;
      const finish = (val: string | null) => {
        if (settled) return;
        settled = true;
        try { reqIface.removeAllListeners('Response'); } catch {}
        resolve(val);
      };
      const timer = setTimeout(() => finish(null), timeoutMs);

      reqIface.on('Response', (response: number, results: Record<string, dbus.Variant>) => {
        clearTimeout(timer);
        if (response !== 0) return finish(null); // 1 = cancelled, 2 = ended
        const color = results['color']?.value as number[] | undefined;
        if (!color || color.length < 3) return finish(null);
        finish(`#${toHex(color[0])}${toHex(color[1])}${toHex(color[2])}`);
      });
    });
  } catch {
    return null;
  }
}
