import { execFileSync } from 'node:child_process';

/**
 * Best-effort focused-app detection. xdotool works on X11/XWayland; on pure
 * Wayland the GNOME extension pushes the focused app via SetFocusedApp D-Bus.
 * That value wins when it's recent (within 5s).
 */
let _shellPushed: { appId: string; at: number } | null = null;
export function setFocusedAppFromShell(appId: string): void {
  _shellPushed = { appId, at: Date.now() };
}

export function currentFocusedApp(): string | null {
  if (_shellPushed && Date.now() - _shellPushed.at < 5000) {
    return _shellPushed.appId || null;
  }
  try {
    const out = execFileSync('xdotool', ['getactivewindow', 'getwindowname'], {
      timeout: 200,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}
