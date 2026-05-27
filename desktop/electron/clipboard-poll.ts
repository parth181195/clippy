import { clipboard, nativeImage } from 'electron';
import { createHash } from 'node:crypto';

export type ClipboardEvent =
  | { kind: 'text'; content: string; mime: string }
  | { kind: 'image'; pngBytes: Buffer };

export interface PollHandle {
  stop: () => void;
}

/**
 * Polls Electron's clipboard at `intervalMs` and emits events on change.
 * Electron's `clipboard.readText()` / `readImage()` work cleanly on Wayland —
 * no Wayland clipboard-daemon stalls like arboard had in the Rust version.
 */
export function startPolling(
  intervalMs: number,
  isPaused: () => boolean,
  onEvent: (e: ClipboardEvent) => void
): PollHandle {
  let lastText: string | null = null;
  let lastImageHash: string | null = null;
  let stopped = false;
  const timer = setInterval(() => {
    if (stopped || isPaused()) return;

    try {
      const text = clipboard.readText();
      if (text && text !== lastText) {
        lastText = text;
        onEvent({ kind: 'text', content: text, mime: 'text/plain' });
      }
    } catch {}

    try {
      const img = clipboard.readImage();
      if (img && !img.isEmpty()) {
        const png = img.toPNG();
        if (png.length > 0) {
          const hash = createHash('sha256').update(png).digest('hex');
          if (hash !== lastImageHash) {
            lastImageHash = hash;
            onEvent({ kind: 'image', pngBytes: png });
          }
        }
      }
    } catch {}
  }, intervalMs);
  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
  };
}

export { nativeImage };
