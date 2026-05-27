import { Notification } from 'electron';
import type { ContentType } from './ipc-types';

export class Notifier {
  private enabled: boolean;
  constructor(enabled: boolean) {
    this.enabled = enabled;
  }
  setEnabled(v: boolean): void {
    this.enabled = v;
  }
  notifyCapture(ct: ContentType, preview: string): void {
    if (!this.enabled) return;
    const titleMap: Record<ContentType, string> = {
      text: 'Text captured',
      link: 'Link captured',
      code: 'Code captured',
      color: 'Color captured',
      emoji: 'Emoji captured',
      image: 'Image captured',
      file: 'File path captured',
    };
    new Notification({
      title: titleMap[ct],
      body: preview.slice(0, 140),
      silent: true,
    }).show();
  }
}
