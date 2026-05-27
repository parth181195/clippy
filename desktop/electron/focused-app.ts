import { execFileSync } from 'node:child_process';

/**
 * Best-effort focused-app detection. xdotool works on X11 and XWayland but
 * not pure Wayland. The GNOME extension (Part C) will provide the reliable
 * Wayland path via D-Bus FocusedWindowChanged signal.
 */
export function currentFocusedApp(): string | null {
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
