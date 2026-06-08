import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Mac click-sound on every captured clip. Shells `afplay` which is part of
 * the base OS — no extra dependency. Tries the macOS Glass system sound
 * first (matches the OS clipboard-action UX), falls back to our bundled OGG.
 */
export class MacSoundPlayer {
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
    // System sound first — matches what Mac users hear from native apps.
    const sys = spawn('afplay', ['/System/Library/Sounds/Glass.aiff'], { stdio: 'ignore' });
    sys.on('error', () => {
      if (!this.bundledSound || !existsSync(this.bundledSound)) return;
      spawn('afplay', [this.bundledSound], { stdio: 'ignore' }).on('error', () => {});
    });
  }
}
