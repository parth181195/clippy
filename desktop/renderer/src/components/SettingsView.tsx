import { useEffect, useState } from 'react';
import { ExternalLink, Plus, Smartphone, Terminal, Unlink, X } from 'lucide-react';
import { useSettingsStore } from '../lib/store';
import type { ClipActionDto, ConnStatus, Settings } from '../../../electron/ipc-types';
import { Switch } from './Switch';

type Section = 'general' | 'hotkeys' | 'exclusions' | 'layout' | 'devices' | 'actions' | 'about';

const ACCENT_SWATCHES = ['#E95678', '#7C7CFF', '#5BC0BE', '#C792EA', '#ECECF1'];

export function SettingsView() {
  const [section, setSection] = useState<Section>('general');
  const s = useSettingsStore((s) => s.s);
  const save = useSettingsStore((s) => s.save);
  if (!s) return <div>Loading…</div>;
  return (
    <div className="settings">
      <nav>
        {(['general', 'hotkeys', 'exclusions', 'layout', 'devices', 'actions', 'about'] as Section[]).map(
          (id) => (
            <button
              key={id}
              className={section === id ? 'active' : ''}
              onClick={() => setSection(id)}
              type="button"
            >
              {id}
            </button>
          )
        )}
      </nav>
      <div className="body">
        {section === 'general' && <General s={s} save={save} />}
        {section === 'layout' && <Layout s={s} save={save} />}
        {section === 'hotkeys' && <Hotkeys s={s} save={save} />}
        {section === 'exclusions' && <Exclusions />}
        {section === 'devices' && <Devices />}
        {section === 'actions' && <Actions />}
        {section === 'about' && (
          <>
            <h3>About</h3>
            <p>Clippy v0.1.0 — LAN-only clipboard manager</p>
          </>
        )}
      </div>
      <style>{settingsCss}</style>
    </div>
  );
}

const ACTION_TYPES = ['text', 'link', 'code', 'color', 'emoji'];

function Actions() {
  const [type, setType] = useState('link');
  const [list, setList] = useState<ClipActionDto[]>([]);
  const [label, setLabel] = useState('');
  const [command, setCommand] = useState('');

  async function refresh() {
    setList(await window.clippy.actionsList(type));
  }
  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, [type]);

  async function add() {
    const cmd = command.trim();
    if (!cmd) return;
    await window.clippy.actionAdd(type, label.trim() || cmd, cmd, []);
    setLabel(''); setCommand('');
    await refresh();
  }

  return (
    <>
      <h3>Per-type Actions</h3>
      <p className="hint">
        Actions show in a clip's right-click menu. The clip's text is passed to your
        command as the final argument (no shell, so it's injection-safe).
        e.g. command <code>code</code> opens the clip in VS Code.
      </p>
      <div className="act-types">
        {ACTION_TYPES.map((t) => (
          <button key={t} className={`act-type ${t === type ? 'active' : ''}`} onClick={() => setType(t)} type="button">
            {t}
          </button>
        ))}
      </div>
      <div className="act-list">
        {list.length === 0 && <div className="act-empty">No actions for {type}.</div>}
        {list.map((a) => (
          <div key={a.id} className="act-row">
            {a.kind === 'open_url' ? <ExternalLink size={14} /> : <Terminal size={14} />}
            <div className="act-meta">
              <div className="act-label">{a.label}</div>
              <div className="act-cmd">
                {a.kind === 'open_url' ? 'xdg-open <url>' : `${a.command} … <text>`}
              </div>
            </div>
            {a.kind === 'open_url' ? (
              <span className="act-builtin">built-in</span>
            ) : (
              <button className="act-del" type="button" onClick={() => window.clippy.actionRemove(a.id).then(refresh)} aria-label="Remove">
                <X size={13} strokeWidth={2.5} />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="act-add">
        <input type="text" placeholder="label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input type="text" placeholder="command e.g. code" value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void add(); }} />
        <button type="button" className="act-add-btn" onClick={add} disabled={!command.trim()}>
          <Plus size={13} strokeWidth={2.4} /> Add
        </button>
      </div>
      <style>{actionsCss}</style>
    </>
  );
}

const actionsCss = `
  .act-types { display: flex; gap: 6px; margin: 12px 0 16px; flex-wrap: wrap; }
  .act-type {
    padding: 5px 12px; border-radius: 14px; cursor: pointer;
    background: transparent; color: var(--cm-text-secondary);
    border: 1px solid var(--cm-border-subtle);
    font-family: inherit; font-size: 12px; text-transform: capitalize;
  }
  .act-type.active { background: var(--cm-surface-raised); color: var(--cm-text); border-color: var(--cm-border-strong); }
  .act-list { display: flex; flex-direction: column; gap: 6px; }
  .act-empty { color: var(--cm-text-tertiary); font-size: 12px; padding: 6px 0; }
  .act-row {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 12px; border-radius: 9px;
    background: var(--cm-surface-raised); border: 1px solid var(--cm-border-subtle);
    color: var(--cm-text);
  }
  .act-meta { flex: 1; min-width: 0; }
  .act-label { font-size: 13px; font-weight: 500; }
  .act-cmd { font-size: 11px; color: var(--cm-text-tertiary); font-family: 'Geist Mono', ui-monospace, monospace; margin-top: 1px; }
  .act-builtin { font-size: 10px; color: var(--cm-text-tertiary); font-family: 'Geist Mono', ui-monospace, monospace; }
  .act-del {
    width: 20px; height: 20px; border-radius: 10px; border: none; cursor: pointer;
    background: transparent; color: var(--cm-text-secondary);
    display: inline-flex; align-items: center; justify-content: center;
  }
  .act-del:hover { background: color-mix(in srgb, #f87171 18%, transparent); color: #f87171; }
  .act-add { display: flex; gap: 8px; margin-top: 16px; }
  .act-add input:first-child { width: 140px; flex: none; }
  .act-add input:nth-child(2) { flex: 1; }
  .act-add-btn {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 5px 12px; border-radius: 7px;
    background: var(--cm-accent); color: white; border: none;
    font-family: inherit; font-size: 12px; font-weight: 500; cursor: pointer;
  }
  .act-add-btn:disabled { opacity: .4; cursor: not-allowed; }
`;

function Exclusions() {
  const [apps, setApps] = useState<string[]>([]);
  const [draft, setDraft] = useState('');

  async function refresh() {
    setApps(await window.clippy.exclusionsList());
  }
  useEffect(() => { void refresh(); }, []);

  async function add() {
    const v = draft.trim().toLowerCase();
    if (!v) return;
    await window.clippy.exclusionsAdd(v);
    setDraft('');
    await refresh();
  }
  async function remove(id: string) {
    await window.clippy.exclusionsRemove(id);
    await refresh();
  }

  return (
    <>
      <h3>Exclusions</h3>
      <p className="hint">
        Clips copied while one of these apps is focused are skipped. Use the app's
        process / window-class name (e.g. <code>keepassxc</code>, <code>bitwarden</code>).
      </p>
      <div className="excl-add">
        <input
          type="text"
          placeholder="add app id…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void add(); }}
        />
        <button type="button" className="excl-add-btn" onClick={add} disabled={!draft.trim()}>
          <Plus size={13} strokeWidth={2.4} /> Add
        </button>
      </div>
      <div className="excl-list">
        {apps.length === 0 && <div className="excl-empty">No exclusions.</div>}
        {apps.map((id) => (
          <div key={id} className="excl-chip">
            <span>{id}</span>
            <button type="button" onClick={() => remove(id)} aria-label="Remove">
              <X size={11} strokeWidth={2.5} />
            </button>
          </div>
        ))}
      </div>
      <style>{exclusionsCss}</style>
    </>
  );
}

const exclusionsCss = `
  .excl-add { display: flex; gap: 8px; margin-top: 12px; }
  .excl-add input { flex: 1; }
  .excl-add-btn {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 5px 12px; border-radius: 7px;
    background: var(--cm-accent); color: white; border: none;
    font-family: inherit; font-size: 12px; font-weight: 500;
    cursor: pointer;
  }
  .excl-add-btn:disabled { opacity: .4; cursor: not-allowed; }
  .excl-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 16px; }
  .excl-empty { color: var(--cm-text-tertiary); font-size: 12px; padding: 8px 0; }
  .excl-chip {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 4px 4px 10px; border-radius: 12px;
    background: var(--cm-surface-raised);
    border: 1px solid var(--cm-border-strong);
    color: var(--cm-text); font-size: 12px;
    font-family: 'Geist Mono', ui-monospace, monospace;
  }
  .excl-chip button {
    width: 18px; height: 18px; border-radius: 9px;
    background: transparent; border: none; color: var(--cm-text-secondary);
    cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
  }
  .excl-chip button:hover { background: color-mix(in srgb, var(--cm-text) 10%, transparent); color: var(--cm-text); }
`;

function Devices() {
  const [conn, setConn] = useState<ConnStatus>({ state: 'unpaired', deviceName: null });
  useEffect(() => {
    void window.clippy.pairingState().then(setConn);
    const off = window.clippy.onConnState(setConn);
    return () => off();
  }, []);
  const stateLabel = {
    connected: 'Connected',
    connecting: 'Connecting…',
    disconnected: 'Offline',
    unpaired: 'Not paired',
  }[conn.state];
  const dotColor = {
    connected: '#4ade80',
    connecting: '#facc15',
    disconnected: '#f87171',
    unpaired: 'var(--cm-text-tertiary)',
  }[conn.state];
  return (
    <>
      <h3>Devices</h3>
      <p className="hint">
        Only one paired device for v1. Pair from the footer indicator or via the panel.
      </p>
      {conn.state === 'unpaired' ? (
        <div className="device-empty">
          <Smartphone size={32} strokeWidth={1.5} />
          <div>No paired device.</div>
        </div>
      ) : (
        <div className="device-card">
          <div className="device-row">
            <Smartphone size={20} strokeWidth={2} />
            <div className="device-meta">
              <div className="device-name">{conn.deviceName ?? 'phone'}</div>
              <div className="device-state">
                <span className="device-dot" style={{ background: dotColor }} />
                {stateLabel}
              </div>
            </div>
            <button
              className="device-unpair"
              type="button"
              onClick={() => window.clippy.unpair()}
            >
              <Unlink size={13} strokeWidth={2} /> Unpair
            </button>
          </div>
        </div>
      )}
      <style>{devicesCss}</style>
    </>
  );
}

const devicesCss = `
  .device-empty {
    display: flex; flex-direction: column; align-items: center; gap: 10px;
    padding: 32px; color: var(--cm-text-tertiary);
  }
  .device-card {
    margin-top: 12px;
    background: var(--cm-surface-raised);
    border: 1px solid var(--cm-border-subtle);
    border-radius: 10px; padding: 14px;
  }
  .device-row { display: flex; align-items: center; gap: 12px; }
  .device-meta { flex: 1; min-width: 0; }
  .device-name { color: var(--cm-text); font-weight: 600; font-size: 13px; }
  .device-state {
    display: inline-flex; align-items: center; gap: 6px;
    color: var(--cm-text-secondary); font-size: 11.5px; margin-top: 2px;
    font-family: 'Geist Mono', ui-monospace, monospace;
  }
  .device-dot { width: 7px; height: 7px; border-radius: 50%; }
  .device-unpair {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 6px 11px; border-radius: 7px;
    background: transparent; color: #f87171;
    border: 1px solid color-mix(in srgb, #f87171 35%, transparent);
    font-size: 12px; font-weight: 500; cursor: pointer;
    font-family: inherit;
  }
  .device-unpair:hover { background: color-mix(in srgb, #f87171 12%, transparent); }
`;

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="row">
      <label>{label}</label>
      <div>{children}</div>
    </div>
  );
}

function General({
  s,
  save,
}: {
  s: Settings;
  save: (patch: Partial<Settings>) => Promise<void>;
}) {
  return (
    <>
      <h3>General</h3>
      <Row label="Sound on copy">
        <Switch checked={s.soundOnCopy} onCheckedChange={(v) => save({ soundOnCopy: v })} />
      </Row>
      <Row label="Notifications on copy">
        <Switch checked={s.notificationsOnCopy} onCheckedChange={(v) => save({ notificationsOnCopy: v })} />
      </Row>
      <Row label="Link previews (network egress on view)">
        <Switch checked={s.linkPreviewsEnabled} onCheckedChange={(v) => save({ linkPreviewsEnabled: v })} />
      </Row>
      <Row label="Auto-sync outgoing (text-shaped → phone)">
        <Switch checked={s.autoSyncOutgoing} onCheckedChange={(v) => save({ autoSyncOutgoing: v })} />
      </Row>
      <Row label="Auto-sync incoming (text-shaped ← phone)">
        <Switch checked={s.autoSyncIncoming} onCheckedChange={(v) => save({ autoSyncIncoming: v })} />
      </Row>
      <Row label="History size">
        <input
          type="number"
          min={50}
          max={10000}
          value={s.historySize}
          onChange={(e) => save({ historySize: parseInt(e.target.value, 10) || s.historySize })}
        />
      </Row>
      <Row label="Polling interval (ms)">
        <input
          type="number"
          min={100}
          max={1000}
          value={s.pollingMs}
          onChange={(e) => save({ pollingMs: parseInt(e.target.value, 10) || s.pollingMs })}
        />
      </Row>
      <Row label="Incognito auto-disable (sec)">
        <input
          type="number"
          min={60}
          max={3600}
          value={s.incognitoAutoDisableSecs}
          onChange={(e) =>
            save({
              incognitoAutoDisableSecs:
                parseInt(e.target.value, 10) || s.incognitoAutoDisableSecs,
            })
          }
        />
      </Row>
    </>
  );
}

function Layout({ s, save }: { s: Settings; save: (patch: Partial<Settings>) => Promise<void> }) {
  return (
    <>
      <h3>Layout</h3>
      <Row label="Layout">
        <select value={s.layout} onChange={(e) => save({ layout: e.target.value })}>
          <option value="cards">Cards (default)</option>
          <option value="spotlight">Spotlight</option>
          <option value="sectioned">Sectioned</option>
          <option value="mosaic">Mosaic</option>
        </select>
      </Row>
      <Row label="Density">
        <select value={s.density} onChange={(e) => save({ density: e.target.value })}>
          <option value="compact">Compact</option>
          <option value="comfortable">Comfortable</option>
          <option value="spacious">Spacious</option>
        </select>
      </Row>
      <Row label="Theme">
        <select value={s.theme} onChange={(e) => save({ theme: e.target.value })}>
          <option value="auto">Auto</option>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="oled">OLED (pure black)</option>
        </select>
      </Row>
      <Row label="Accent">
        <div className="swatches">
          {ACCENT_SWATCHES.map((sw) => (
            <button
              key={sw}
              type="button"
              className={`swatch ${s.accent === sw ? 'active' : ''}`}
              style={{ background: sw }}
              onClick={() => save({ accent: sw })}
              aria-label={sw}
            />
          ))}
        </div>
      </Row>
      <Row label="Window transparency">
        <Switch checked={s.windowTransparent} onCheckedChange={(v) => save({ windowTransparent: v })} />
      </Row>
    </>
  );
}

function Hotkeys({
  s,
  save,
}: {
  s: Settings;
  save: (patch: Partial<Settings>) => Promise<void>;
}) {
  return (
    <>
      <h3>Hotkeys (rebindable)</h3>
      <p className="hint">Restart Clippy to pick up changes.</p>
      <Row label="Open panel">
        <input
          type="text"
          value={s.hotkeyPanel}
          onChange={(e) => save({ hotkeyPanel: e.target.value })}
        />
      </Row>
      <Row label="Quick-paste last clip">
        <input
          type="text"
          value={s.hotkeyPasteLast}
          onChange={(e) => save({ hotkeyPasteLast: e.target.value })}
        />
      </Row>
      <Row label="Toggle incognito">
        <input
          type="text"
          value={s.hotkeyIncognito}
          onChange={(e) => save({ hotkeyIncognito: e.target.value })}
        />
      </Row>
    </>
  );
}

const settingsCss = `
  .settings { display: flex; height: 100%; }
  .settings nav {
    width: 180px; border-right: 1px solid var(--cm-border-subtle);
    padding: 14px 8px; display: flex; flex-direction: column; gap: 1px;
  }
  .settings nav button {
    padding: 7px 11px; border-radius: 7px; font-size: 13px; font-weight: 500;
    color: var(--cm-text-secondary); background: transparent; border: none;
    cursor: pointer; text-align: left; text-transform: capitalize;
    font-family: inherit;
  }
  .settings nav button.active { color: var(--cm-text); background: var(--cm-surface-raised); }
  .settings .body { flex: 1; padding: 18px 28px; overflow: auto; color: var(--cm-text); }
  .settings h3 { margin: 0 0 14px; font-size: 15px; font-weight: 600; }
  .settings .row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 0; border-bottom: 1px solid var(--cm-border-subtle); gap: 12px;
  }
  .settings label { font-size: 13px; font-weight: 500; }
  .settings input[type=number], .settings input[type=text], .settings select {
    background: var(--cm-surface-raised); color: var(--cm-text);
    border: 1px solid var(--cm-border-strong); border-radius: 7px;
    padding: 5px 10px; font-family: inherit; font-size: 12px;
  }
  .settings .hint { font-size: 11.5px; color: var(--cm-text-secondary); }
  .settings .swatches { display: flex; gap: 6px; }
  .settings .swatch {
    width: 22px; height: 22px; border-radius: 50%;
    border: 2px solid transparent; cursor: pointer;
    /* faint ring so near-white swatches (bone) stay visible on a light surface */
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--cm-text) 18%, transparent);
  }
  .settings .swatch.active { border-color: var(--cm-text); }
`;
