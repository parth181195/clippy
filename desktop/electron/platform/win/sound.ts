import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Windows click-sound. Plays the OS "Notify" system sound via PowerShell's
 * SystemSounds API — same UX as a native Windows notification. Falls back
 * to the bundled OGG if PowerShell isn't available (very rare on supported
 * Windows 10+ targets).
 */
export class WinSoundPlayer {
  private enabled: boolean;
  private bundledSound: string;

  constructor(enabled: boolean) {
    this.enabled = enabled;
    const dev = join(process.cwd(), 'assets', 'sounds', 'copy.ogg');
    const prod = join(process.resourcesPath ?? '', 'assets', 'sounds', 'copy.ogg');
    this.bundledSound = existsSync(dev) ? dev : prod;
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
  }

  play(): void {
    if (!this.enabled) return;
    // [System.Media.SystemSounds]::Asterisk matches the Windows clipboard-
    // action UX (the gentle two-tone). Fire-and-forget — we don't care
    // about completion.
    const ps =
      '[System.Media.SystemSounds]::Asterisk.Play()';
    const proc = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', ps],
      { stdio: 'ignore', windowsHide: true },
    );
    proc.on('error', () => {
      if (!this.bundledSound || !existsSync(this.bundledSound)) return;
      // Last resort: play the bundled OGG via PowerShell SoundPlayer.
      const ps2 = `(New-Object System.Media.SoundPlayer '${this.bundledSound.replace(/'/g, "''")}').Play()`;
      spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps2], {
        stdio: 'ignore',
        windowsHide: true,
      }).on('error', () => {});
    });
  }
}
