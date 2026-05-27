import type { Db } from './db';
import { detectText } from './detect';
import type { ClipboardEvent } from './clipboard-poll';
import type { ContentType } from './ipc-types';

export interface PipelineDeps {
  db: Db;
  excludedApps: string[];
  historySize: number;
  getFocusedApp: () => string | null;
  onNewClip: (id: number, contentType: ContentType) => void;
}

export function makeHandler(deps: PipelineDeps): (e: ClipboardEvent) => void {
  return (ev) => {
    const focused = deps.getFocusedApp();
    if (focused && deps.excludedApps.some((a) => a.toLowerCase() === focused.toLowerCase())) {
      return;
    }
    if (ev.kind === 'text') {
      const ct = detectText(ev.content, focused);
      const preview = ev.content.slice(0, 280);
      try {
        const ins = deps.db.insertClip(
          ct,
          Buffer.from(ev.content, 'utf8'),
          ev.mime,
          preview,
          focused,
          Date.now()
        );
        if (ins.wasNew) {
          deps.onNewClip(ins.id, ct);
          deps.db.prune(deps.historySize);
        }
      } catch (e) {
        console.warn('[pipeline] text insert failed', e);
      }
      return;
    }
    if (ev.kind === 'image') {
      const preview = `Image ${ev.pngBytes.length} bytes`;
      try {
        const ins = deps.db.insertClip(
          'image',
          ev.pngBytes,
          'image/png',
          preview,
          focused,
          Date.now()
        );
        if (ins.wasNew) {
          // thumbnail: store the PNG itself (Electron renders it fine; resize
          // can come later via Sharp if we want true 200x200 thumbnails)
          deps.db.setThumbnail(ins.id, ev.pngBytes);
          deps.onNewClip(ins.id, 'image');
          deps.db.prune(deps.historySize);
        }
      } catch (e) {
        console.warn('[pipeline] image insert failed', e);
      }
    }
  };
}
