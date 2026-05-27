import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Plays the system "message" event sound on every captured clip.
 * Mirrors Pano's behaviour (GSound.play_simple({id: 'message'})) by shelling
 * out to canberra-gtk-play. Falls back to paplay on the bundled OGA if libcanberra
 * isn't installed (rare on a standard Ubuntu/GNOME system).
 */
export class SoundPlayer {
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

  playCopy(): void {
    if (!this.enabled) return;
    // Primary: matches Pano exactly (freedesktop sound theme 'message' event).
    const canberra = spawn('canberra-gtk-play', ['-i', 'message'], { stdio: 'ignore' });
    canberra.on('error', () => {
      // Fallback: play the bundled .oga via paplay (PulseAudio/PipeWire).
      if (!this.bundledSound || !existsSync(this.bundledSound)) return;
      const paplay = spawn('paplay', [this.bundledSound], { stdio: 'ignore' });
      paplay.on('error', () => {
        // Last resort: aplay (ALSA).
        spawn('aplay', [this.bundledSound], { stdio: 'ignore' }).on('error', () => {});
      });
    });
  }
}
