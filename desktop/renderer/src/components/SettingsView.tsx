import { useState } from 'react';
import { useSettingsStore } from '../lib/store';
import type { Settings } from '../../../electron/ipc-types';
import { Switch } from './Switch';

type Section = 'general' | 'hotkeys' | 'exclusions' | 'layout' | 'actions' | 'about';

const ACCENT_SWATCHES = ['#E95678', '#7C7CFF', '#5BC0BE', '#C792EA', '#ECECF1'];

export function SettingsView() {
  const [section, setSection] = useState<Section>('general');
  const s = useSettingsStore((s) => s.s);
  const save = useSettingsStore((s) => s.save);
  if (!s) return <div>Loading…</div>;
  return (
    <div className="settings">
      <nav>
        {(['general', 'hotkeys', 'exclusions', 'layout', 'actions', 'about'] as Section[]).map(
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
        {section === 'exclusions' && (
          <>
            <h3>Exclusions</h3>
            <p className="hint">Clips copied while one of these apps is focused are skipped.</p>
          </>
        )}
        {section === 'actions' && (
          <>
            <h3>Per-type Actions</h3>
            <p className="hint">Editor lands in a follow-up.</p>
          </>
        )}
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
  }
  .settings .swatch.active { border-color: var(--cm-text); }
`;
