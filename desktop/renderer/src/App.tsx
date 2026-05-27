import { useEffect, useState } from 'react';
import './clippy.d.ts';

interface ClipPreview {
  id: number;
  contentType: string;
  preview: string;
}

export function App() {
  const [clips, setClips] = useState<ClipPreview[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!window.clippy) {
      setError('window.clippy not available (preload failed?)');
      return;
    }
    window.clippy
      .listClips({ limit: 50 })
      .then((cs) => setClips(cs.map((c) => ({ id: c.id, contentType: c.contentType, preview: c.preview }))))
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <div className="panel">
      <div className="drag-handle" />
      <header>
        <strong>Clippy</strong>
        <span style={{ fontSize: 11, color: 'var(--cm-text-tertiary)', fontFamily: 'Geist Mono, ui-monospace, monospace' }}>
          Electron + React port · {clips.length} clips
        </span>
      </header>
      <main>
        {error && <div style={{ padding: 20, color: '#E95678' }}>error: {error}</div>}
        {!error && clips.length === 0 && (
          <div style={{ padding: 20, color: 'var(--cm-text-secondary)' }}>
            No clips yet. Capture pipeline lands in the next batch.
          </div>
        )}
        {clips.map((c) => (
          <div key={c.id} className="row">
            <span className="badge">{c.contentType.toUpperCase()}</span>
            <span className="text">{c.preview.slice(0, 80)}</span>
          </div>
        ))}
      </main>
      <footer>port skeleton OK · IPC + DB wired</footer>
      <style>{css}</style>
    </div>
  );
}

const css = `
  .panel { display: flex; flex-direction: column; height: 100%;
    background: var(--cm-panel-scrim); backdrop-filter: blur(24px) saturate(140%);
    border-radius: var(--cm-radius-panel); border: 1px solid var(--cm-border-subtle);
    color: var(--cm-text); overflow: hidden; }
  .drag-handle { -webkit-app-region: drag; height: 10px; width: 100%;
    background: linear-gradient(180deg, rgba(255,255,255,.04), transparent); flex-shrink: 0; }
  header { -webkit-app-region: drag; display: flex; align-items: center; justify-content: space-between;
    height: 48px; padding: 0 16px; border-bottom: 1px solid var(--cm-border-subtle); flex-shrink: 0; }
  main { flex: 1; overflow-y: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 6px; }
  .row { display: flex; align-items: center; gap: 10px; padding: 6px 10px; border-radius: 7px;
    background: var(--cm-surface); border: 1px solid var(--cm-border-subtle); }
  .badge { padding: 3px 7px; border-radius: 6px; font-size: 10px; font-weight: 600;
    background: var(--badge-text-bg); color: var(--badge-text-fg); }
  .text { flex: 1; min-width: 0; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  footer { height: 28px; padding: 0 20px; display: flex; align-items: center;
    border-top: 1px solid var(--cm-border-subtle); font-size: 11px; color: var(--cm-text-tertiary);
    font-family: 'Geist Mono', ui-monospace, monospace; }
`;
