import { Bonjour } from 'bonjour-service';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

function log(msg: string) {
  try {
    appendFileSync(
      join(app.getPath('userData'), 'clippy', 'sync.log'),
      `[${new Date().toISOString()}] [mdns] ${msg}\n`
    );
  } catch {}
}

export class MdnsAdvertise {
  private bonjour: InstanceType<typeof Bonjour> | null = null;
  private service: ReturnType<InstanceType<typeof Bonjour>['publish']> | null = null;

  start(opts: { name: string; deviceId: string; port: number; version: string }): void {
    this.bonjour = new Bonjour();
    this.service = this.bonjour.publish({
      name: opts.name,
      type: 'clippy',
      protocol: 'tcp',
      port: opts.port,
      txt: { device_id: opts.deviceId, version: opts.version },
    });
    log(`advertising _clippy._tcp.local "${opts.name}" on port ${opts.port}`);
  }

  stop(): void {
    try { this.service?.stop?.(() => {}); } catch {}
    try { this.bonjour?.destroy(); } catch {}
    this.service = null;
    this.bonjour = null;
  }
}
