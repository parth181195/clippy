import { clipboard, nativeImage } from 'electron';
import { spawn } from 'node:child_process';

/**
 * Paste-by-typing for text content. Bypasses bracketed-paste mode because
 * we never trigger a real paste event — we just emit raw keystrokes, which
 * the terminal/editor receives as ordinary input. Works in every input field.
 *
 * For images, falls back to clipboard + synthesised Ctrl+V (there's no
 * realistic alternative for binary content).
 */
export async function pasteToActive(
  content: Buffer,
  mime: string,
  shiftForTerminal: boolean
): Promise<void> {
  // Give focus a beat to return to the previously-focused window after Clippy hides.
  // Bumped to 200ms because some hotkeys (function keys, modifier+function) take time
  // for the terminal/app to finish dispatching their own keydown before our injected
  // text starts arriving, otherwise residual bytes can leak into the receiver's buffer.
  await new Promise((r) => setTimeout(r, 200));

  if (mime.startsWith('text/')) {
    const text = content.toString('utf8');
    // Try direct-typing tools in order. Each types the text as keystrokes,
    // so no clipboard, no bracketed-paste, no terminal-paste-shortcut differences.
    if (await runOk('wtype', ['--', text])) return;
    if (await runOk('xdotool', ['type', '--clearmodifiers', '--delay', '0', text])) return;
    if (await runOk('ydotool', ['type', text])) return;
    // Last resort: clipboard + Ctrl+V (subject to bracketed paste in terminals).
    clipboard.writeText(text);
    await new Promise((r) => setTimeout(r, 40));
    await synthesisePaste(shiftForTerminal);
    return;
  }

  // Image / other binary
  if (mime.startsWith('image/')) {
    clipboard.writeImage(nativeImage.createFromBuffer(content));
  } else {
    clipboard.writeText(content.toString('utf8'));
  }
  await new Promise((r) => setTimeout(r, 60));
  await synthesisePaste(shiftForTerminal);
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
