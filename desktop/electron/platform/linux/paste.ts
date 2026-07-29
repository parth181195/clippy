import { clipboard, nativeImage } from 'electron';
import { spawn } from 'node:child_process';

/**
 * Paste on Linux by writing content to the system clipboard then delivering a
 * single Ctrl+V (or Ctrl+Shift+V for terminals) keystroke.
 *
 * We used to type text character-by-character via `wtype`/`xdotool`/`ydotool`,
 * which had two problems on GNOME Wayland:
 *   1. Every call to ydotool triggers the RemoteDesktop portal permission
 *      prompt — Mutter routes synthetic input through the portal, and the
 *      grant isn't persistent across short-lived process spawns.
 *   2. If the user clicks into a different window mid-type, the remaining
 *      characters land in the wrong place.
 *
 * The clipboard-write + single-chord path is atomic (one keystroke) and, when
 * routed through the GNOME extension's `io.clippy.Shell.PasteChord` D-Bus
 * method, avoids the portal entirely (the extension runs inside gnome-shell
 * and has direct Wayland input access). Shell-tool fallbacks stay in place
 * for users who don't have the extension enabled.
 */
export async function pasteToActive(
  content: Buffer,
  mime: string,
  shiftForTerminal: boolean,
): Promise<void> {
  // Give focus a beat to return to the previously-focused window after
  // Clippy hides. 200 ms is long enough for hotkey-triggered dispatches to
  // finish so residual bytes don't leak into the receiving app.
  await new Promise((r) => setTimeout(r, 200));

  if (mime.startsWith('text/')) {
    clipboard.writeText(content.toString('utf8'));
  } else if (mime.startsWith('image/')) {
    clipboard.writeImage(nativeImage.createFromBuffer(content));
  } else {
    clipboard.writeText(content.toString('utf8'));
  }
  // Give the clipboard write a beat to propagate to the compositor.
  await new Promise((r) => setTimeout(r, 60));

  // Prefer the extension path — no portal prompt, one atomic chord.
  if (await pasteViaShellExtension(shiftForTerminal)) return;

  // Fallback: wtype / xdotool / ydotool for a single Ctrl+V. Users without
  // the GNOME extension enabled will see one portal prompt per paste here.
  await synthesisePaste(shiftForTerminal);
}

/**
 * Ask the bundled GNOME extension to deliver the Ctrl+V chord via Clutter's
 * virtual input device (Wayland-native, no portal). Returns false if the
 * extension isn't loaded / hasn't exported the service yet — caller falls
 * back to shell tools.
 */
async function pasteViaShellExtension(shifted: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const proc = spawn(
        'gdbus',
        [
          'call', '--session',
          '--dest', 'io.clippy.Shell',
          '--object-path', '/io/clippy/Shell',
          '--method', 'io.clippy.Shell.PasteChord',
          shifted ? 'true' : 'false',
        ],
        { stdio: 'ignore', timeout: 800 },
      );
      let done = false;
      proc.on('error', () => { if (!done) { done = true; resolve(false); } });
      proc.on('exit', (code) => { if (!done) { done = true; resolve(code === 0); } });
    } catch {
      resolve(false);
    }
  });
}

async function synthesisePaste(shift: boolean): Promise<boolean> {
  if (await runOk('wtype', shift
    ? ['-M', 'ctrl', '-M', 'shift', 'v', '-m', 'shift', '-m', 'ctrl']
    : ['-M', 'ctrl', 'v', '-m', 'ctrl'])) return true;
  if (await runOk('xdotool', ['key', '--clearmodifiers', shift ? 'ctrl+shift+v' : 'ctrl+v'])) return true;
  if (await runOk('ydotool', shift
    ? ['key', '29:1', '42:1', '47:1', '47:0', '42:0', '29:0']
    : ['key', '29:1', '47:1', '47:0', '29:0'])) return true;
  console.warn('[paste] no synthesiser available; clipboard is set, press Ctrl+V manually');
  return false;
}

function runOk(cmd: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const proc = spawn(cmd, args, { stdio: 'ignore' });
      let resolved = false;
      proc.on('error', () => {
        if (!resolved) { resolved = true; resolve(false); }
      });
      proc.on('exit', (code) => {
        if (!resolved) { resolved = true; resolve(code === 0); }
      });
    } catch {
      resolve(false);
    }
  });
}
