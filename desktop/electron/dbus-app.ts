import dbus from 'dbus-next';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

const BUS_NAME = 'io.clippy.App';
const OBJECT_PATH = '/io/clippy/App';
const IFACE_NAME = 'io.clippy.App';

let logPath: string;

function log(msg: string) {
  if (!logPath) logPath = join(app.getPath('userData'), 'clippy', 'dbus.log');
  try {
    appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
  console.log('[dbus]', msg);
}

class ClippyAppInterface extends dbus.interface.Interface {
  constructor(private handlers: AppHandlers) {
    super(IFACE_NAME);
  }
  TogglePanel(): void { this.handlers.onToggle(); log('TogglePanel called'); }
  Show(): void { this.handlers.onShow(); log('Show called'); }
  Hide(): void { this.handlers.onHide(); log('Hide called'); }
  PasteLast(): void { this.handlers.onPasteLast(); log('PasteLast called'); }
  ToggleIncognito(): void { this.handlers.onToggleIncognito(); log('ToggleIncognito called'); }
  SetFocusedApp(appId: string): void { this.handlers.onSetFocusedApp(appId); }
}

ClippyAppInterface.configureMembers({
  methods: {
    TogglePanel:      { inSignature: '', outSignature: '' },
    Show:             { inSignature: '', outSignature: '' },
    Hide:             { inSignature: '', outSignature: '' },
    PasteLast:        { inSignature: '', outSignature: '' },
    ToggleIncognito:  { inSignature: '', outSignature: '' },
    SetFocusedApp:    { inSignature: 's', outSignature: '' },
  },
});

export interface AppHandlers {
  onToggle: () => void;
  onShow: () => void;
  onHide: () => void;
  onPasteLast: () => void;
  onToggleIncognito: () => void;
  onSetFocusedApp: (appId: string) => void;
}

export async function startDbusApp(handlers: AppHandlers): Promise<void> {
  try {
    const bus = dbus.sessionBus();
    const iface = new ClippyAppInterface(handlers);
    bus.export(OBJECT_PATH, iface);
    await bus.requestName(BUS_NAME, 0);
    log(`exported ${BUS_NAME} at ${OBJECT_PATH}`);
  } catch (e) {
    log(`startDbusApp failed: ${(e as Error).message}`);
  }
}
