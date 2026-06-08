import { clipboard } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Paste-as-keystroke on macOS via the System Events Apple Event.
 *
 * Unlike the Linux path we DON'T type the text character-by-character —
 * AppleScript `keystroke "long body of text"` actually does that internally
 * and is slow + flaky for big payloads. Instead we briefly stash the content
 * on the system clipboard and synthesize a single ⌘V, then restore whatever
 * was there before. This mirrors how every shipped Mac clipboard manager
 * (Paste, Maccy, Alfred Snippets, ...) does it.
 *
 * The Accessibility prompt fires on first call — we surface it as a one-time
 * setting hint when the AppleScript exits with `osascript: ... (-1719)` or
 * the user hasn't approved Clippy under Privacy → Accessibility.
 *
 * `shiftForTerminal` adds Shift to the Cmd+V (most Mac terminals don't need
 * this — iTerm2 and Terminal.app paste fine with plain ⌘V — but we honour
 * the flag for parity with the Linux call sites).
 */
export async function pasteToActive(
  content: Buffer,
  mime: string,
  shiftForTerminal: boolean,
): Promise<void> {
  // Same 200ms beat as the Linux path so focus has time to return to the
  // previously-focused app after Clippy's window hides.
  await new Promise((r) => setTimeout(r, 200));

  if (!mime.startsWith('text/')) {
    // Binary (images, files) not supported via keystroke paste yet on any
    // platform. Caller should fall back to file-transfer for these.
    return;
  }

  const text = content.toString('utf8');
  // Stash current clipboard state so we can restore it after the paste.
  // electron's clipboard module reads/writes on the main thread synchronously.
  const savedText = clipboard.readText();
  const savedHtml = clipboard.readHTML();

  clipboard.writeText(text);

  // ⌘V (or ⇧⌘V) via osascript. `keystroke "v"` is the cross-app injection
  // path; sending it as a sequence inside a single tell-block keeps focus.
  const modifier = shiftForTerminal ? 'command down, shift down' : 'command down';
  const script = `tell application "System Events" to keystroke "v" using {${modifier}}`;

  try {
    await execFileAsync('osascript', ['-e', script], { timeout: 2000 });
  } finally {
    // Restore the previous clipboard after a beat so the paste actually
    // completes before we overwrite it (otherwise the receiver may end up
    // pasting the OLD content).
    setTimeout(() => {
      if (savedHtml) clipboard.writeHTML(savedHtml);
      else if (savedText) clipboard.writeText(savedText);
      else clipboard.clear();
    }, 300);
  }
}
