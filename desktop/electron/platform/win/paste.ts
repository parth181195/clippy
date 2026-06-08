import { clipboard } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Paste-as-keystroke on Windows.
 *
 * v0.3 stopgap: PowerShell SendKeys via System.Windows.Forms. Spawning
 * `powershell.exe` adds ~500–800 ms of startup latency on each call, which
 * is noticeable for the paste-last hotkey. A follow-up will swap this for
 * a thin native node-addon calling SendInput(VK_CONTROL+V) directly — the
 * issue is filed and not blocking the v0.3 unsigned beta ship.
 *
 * UAC-elevated targets (Task Manager, Registry Editor when launched as
 * admin) do NOT receive synthetic input from an unprivileged process; this
 * is a Windows security boundary, documented in the README under
 * "Known limitations".
 *
 * `shiftForTerminal` sends Ctrl+Shift+V instead of Ctrl+V — most Windows
 * terminals (Windows Terminal, ConEmu, Cmder) accept either; PowerShell
 * console and cmd.exe ignore Ctrl+V entirely (you'd right-click), so this
 * is a no-op there.
 */
export async function pasteToActive(
  content: Buffer,
  mime: string,
  shiftForTerminal: boolean,
): Promise<void> {
  // Mirror Mac/Linux: give focus a beat to return to the previously-focused
  // window after Clippy hides.
  await new Promise((r) => setTimeout(r, 200));

  if (!mime.startsWith('text/')) {
    // Binary (images, files) not supported via keystroke paste yet on any
    // platform. Caller should fall back to file-transfer for these.
    return;
  }

  const text = content.toString('utf8');
  // Stash and restore the system clipboard around the paste so we don't
  // leave whatever the user had there overwritten.
  const savedText = clipboard.readText();
  const savedHtml = clipboard.readHTML();

  clipboard.writeText(text);

  // SendKeys uses ^ for Ctrl and + for Shift. {ENTER}/{TAB} have meaning;
  // since we're only sending a chord, no escaping needed.
  const chord = shiftForTerminal ? '^+v' : '^v';
  const ps = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${chord}')`;

  try {
    await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], {
      timeout: 4000,
      windowsHide: true,
    });
  } finally {
    // Restore after a beat so the paste consumes the new content first.
    setTimeout(() => {
      if (savedHtml) clipboard.writeHTML(savedHtml);
      else if (savedText) clipboard.writeText(savedText);
      else clipboard.clear();
    }, 300);
  }
}
