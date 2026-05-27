import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Settings as SettingsIcon, Smartphone, Star, WifiOff, Zap } from 'lucide-react';
import { PanelLayout } from './components/PanelLayout';
import { Kbd } from './components/Kbd';
import { SearchBar, type SearchBarHandle } from './components/SearchBar';
import { FilterChip } from './components/FilterChip';
import { SettingsView } from './components/SettingsView';
import { EditPane } from './components/EditPane';
import { PairingView } from './components/PairingView';
import type { ConnStatus, TransferProgressEvent } from '../../electron/ipc-types';
import { TransferBanner } from './components/TransferBanner';
import {
  useClipsStore,
  useFilterStore,
  useSelectionStore,
  useSettingsStore,
} from './lib/store';
import './clippy.d';

type Mode = 'list' | 'settings' | 'edit' | 'pair';

const TYPES = ['text', 'image', 'link', 'code', 'color', 'emoji', 'file'] as const;

export function App() {
  const clips = useClipsStore((s) => s.clips);
  const refresh = useClipsStore((s) => s.refresh);
  const toggleFavorite = useClipsStore((s) => s.toggleFavorite);
  const togglePin = useClipsStore((s) => s.togglePin);
  const deleteClip = useClipsStore((s) => s.delete);

  const settings = useSettingsStore((s) => s.s);
  const loadSettings = useSettingsStore((s) => s.load);

  const filter = useFilterStore();
  const selectedHash = useSelectionStore((s) => s.hash);
  const setByHash = useSelectionStore((s) => s.setByHash);

  const [mode, setMode] = useState<Mode>('list');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [conn, setConn] = useState<ConnStatus>({ state: 'unpaired', deviceName: null });
  const [toast, setToast] = useState<string | null>(null);
  const [transfers, setTransfers] = useState<TransferProgressEvent[]>([]);
  const searchRef = useRef<SearchBarHandle>(null);

  // Initial load
  useEffect(() => {
    void loadSettings();
    void refresh().then(() => {
      const first = useClipsStore.getState().clips[0];
      if (first && !useSelectionStore.getState().hash) setByHash(first.hash);
    });
    // Subscribe to clip-new events from main — snap selection to newest.
    const offClip = window.clippy.onClipNew(() => {
      void refresh(filter.search, filter.type, filter.favoritesOnly).then(() => {
        const first = useClipsStore.getState().clips[0];
        if (first) setByHash(first.hash);
      });
    });
    // Hydrate + subscribe to connection-state events
    void window.clippy.pairingState().then(setConn);
    const offConn = window.clippy.onConnState(setConn);
    // Transfer progress: keep up to 4 most-recent, drop done ones after 1.5s.
    const offTr = window.clippy.onTransferProgress((p) => {
      setTransfers((prev) => {
        const others = prev.filter((t) => t.transferId !== p.transferId);
        return [p, ...others].slice(0, 4);
      });
      if (p.done) {
        window.setTimeout(() => {
          setTransfers((prev) => prev.filter((t) => t.transferId !== p.transferId));
        }, 1500);
      }
    });
    return () => { offClip(); offConn(); offTr(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch on filter change
  useEffect(() => {
    void refresh(filter.search, filter.type, filter.favoritesOnly).then(() => {
      const cur = useClipsStore.getState().clips;
      const hashes = new Set(cur.map((c) => c.hash));
      const sel = useSelectionStore.getState().hash;
      if (!sel || !hashes.has(sel)) setByHash(cur[0]?.hash ?? null);
    });
  }, [filter.search, filter.type, filter.favoritesOnly, refresh, setByHash]);

  function selectedIndex(): number {
    return clips.findIndex((c) => c.hash === selectedHash);
  }
  function moveSelection(delta: number) {
    if (clips.length === 0) return;
    const cur = Math.max(0, selectedIndex());
    const next = (cur + delta + clips.length) % clips.length;
    setByHash(clips[next].hash);
  }

  async function pasteSelected(shift: boolean) {
    const i = selectedIndex();
    const c = i >= 0 ? clips[i] : clips[0];
    if (!c) return;
    try {
      await window.clippy.hidePanel();
    } catch {}
    await new Promise((r) => setTimeout(r, 80));
    try {
      await window.clippy.pasteById(c.id, shift);
    } catch (e) {
      console.error('paste failed', e);
    }
  }

  async function toggleFavoriteSelected() {
    const c = clips[selectedIndex()];
    if (c) await toggleFavorite(c.id);
  }
  async function togglePinSelected() {
    const c = clips[selectedIndex()];
    if (c) await togglePin(c.id);
  }
  async function deleteSelected(force: boolean) {
    const c = clips[selectedIndex()];
    if (c) await deleteClip(c.id, force);
  }
  async function sendSelectedToPeer() {
    const c = clips[selectedIndex()];
    if (!c) return;
    if (conn.state !== 'connected') {
      showToast('No device connected');
      return;
    }
    if (c.contentType !== 'image' && c.contentType !== 'file') {
      showToast('Send-to-phone is for images/files (text auto-syncs already)');
      return;
    }
    showToast(`Sending to ${conn.deviceName ?? 'phone'}…`);
    try {
      const tid = await window.clippy.sendClipToPeer(c.id);
      showToast(tid ? 'Sent ✓' : 'Send failed');
    } catch (e: any) {
      showToast(`Send failed: ${e?.message ?? e}`);
    }
  }
  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2400);
  }
  function openEditor() {
    const c = clips[selectedIndex()];
    if (!c) return;
    if (!['text', 'link', 'code', 'color', 'emoji'].includes(c.contentType)) return;
    setEditingId(c.id);
    setMode('edit');
  }

  useEffect(() => {
    async function onKey(e: KeyboardEvent) {
      if (mode === 'edit') return;
      if (mode === 'settings') {
        if (e.key === 'Escape') {
          setMode('list');
          e.preventDefault();
        }
        return;
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        try { await window.clippy.hidePanel(); } catch {}
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        moveSelection(+1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        moveSelection(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        await pasteSelected(e.shiftKey);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        e.shiftKey ? filter.cycleTypeReverse() : filter.cycleType();
      } else if (e.key === 'Backspace' && !filter.search) {
        e.preventDefault();
        filter.setType(null);
      } else if (e.key === 'Delete') {
        e.preventDefault();
        await deleteSelected(e.shiftKey);
      } else if (e.ctrlKey && e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        await sendSelectedToPeer();
      } else if (e.ctrlKey && !e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        await toggleFavoriteSelected();
      } else if ((e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        await togglePinSelected();
      } else if (e.key === 'Alt') {
        filter.setFavoritesOnly(!filter.favoritesOnly);
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        openEditor();
      } else if (/^[\w !@#$%^&*()\-=+[\]{};:'",.<>/?]$/.test(e.key)) {
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, clips, selectedHash, filter]);

  const selectedClipForEdit = clips.find((c) => c.id === editingId) ?? null;

  return (
    <div className="panel">
      <header>
        {mode !== 'list' && (
          <button
            className="back-btn"
            onClick={() => { setMode('list'); setEditingId(null); }}
            aria-label="Back"
            title="Back (Esc)"
            type="button"
          >
            <ArrowLeft size={16} strokeWidth={2} />
          </button>
        )}
        <span className="brand">Clippy{mode !== 'list' && ` · ${mode === 'pair' ? 'Pair device' : mode === 'settings' ? 'Settings' : 'Edit'}`}</span>
        <SearchBar
          ref={searchRef}
          value={filter.search}
          onChange={(v) => filter.setSearch(v)}
        />
        <div className="chips">
          <FilterChip
            label="All"
            count={clips.length}
            active={filter.type === null && !filter.favoritesOnly}
            onClick={() => {
              filter.setType(null);
              filter.setFavoritesOnly(false);
            }}
          />
          <FilterChip
            label="Favorites"
            count={clips.filter((c) => c.isFavorite).length}
            icon={<Star size={12} strokeWidth={2} fill={filter.favoritesOnly ? 'currentColor' : 'none'} />}
            active={filter.favoritesOnly}
            onClick={() => filter.setFavoritesOnly(!filter.favoritesOnly)}
          />
          {TYPES.map((t) => {
            const n = clips.filter((c) => c.contentType === t).length;
            return (
              <FilterChip
                key={t}
                label={t[0].toUpperCase() + t.slice(1)}
                count={n}
                active={filter.type === t}
                onClick={() => filter.setType(filter.type === t ? null : t)}
              />
            );
          })}
        </div>
        <button
          className="settings-btn"
          onClick={() => setMode(mode === 'settings' ? 'list' : 'settings')}
          aria-label="Settings"
          type="button"
        >
          <SettingsIcon size={16} strokeWidth={2} />
        </button>
      </header>
      <main>
        {mode === 'pair' ? (
          <PairingView onClose={() => setMode('list')} />
        ) : mode === 'settings' ? (
          <SettingsView />
        ) : mode === 'edit' && selectedClipForEdit ? (
          <EditPane
            clip={selectedClipForEdit}
            onCancel={() => {
              setMode('list');
              setEditingId(null);
            }}
            onSave={async (_newId, paste) => {
              setMode('list');
              setEditingId(null);
              await refresh(filter.search, filter.type, filter.favoritesOnly);
              if (paste) {
                // pasteSelected will pick the first/most-recent clip (the new one)
                await pasteSelected(false);
              }
            }}
          />
        ) : settings ? (
          <PanelLayout
            layout={settings.layout as any}
            clips={clips}
            selectedHash={selectedHash}
            density={settings.density as any}
            filter={{
              search: filter.search,
              type: filter.type,
              favoritesOnly: filter.favoritesOnly,
            }}
            onSelect={(h) => setByHash(h)}
            buildActions={(c) => ({
              onSend: async () => {
                setByHash(c.hash);
                await sendSelectedToPeer();
              },
              onEdit: () => {
                setByHash(c.hash);
                if (['text', 'link', 'code', 'color', 'emoji'].includes(c.contentType)) {
                  setEditingId(c.id);
                  setMode('edit');
                }
              },
              onToggleFavorite: () => toggleFavorite(c.id),
              onTogglePin: () => togglePin(c.id),
              onDelete: () => deleteClip(c.id, false),
            })}
            canSend={(c) => conn.state === 'connected' && (c.contentType === 'image' || c.contentType === 'file')}
          />
        ) : null}
      </main>
      <footer>
        <span>{clips.length} items</span>
        <span className="dot">·</span>
        <ConnIndicator conn={conn} onPair={() => setMode('pair')} />
        <span className="spacer" />
        <span className="hints">
          <Kbd size="xs">↵</Kbd> paste
          <span className="dot">·</span>
          <Kbd size="xs">⌫</Kbd> delete
          <span className="dot">·</span>
          <Kbd size="xs">⇧</Kbd><Kbd size="xs">⌃</Kbd><Kbd size="xs">S</Kbd> send
          <span className="dot">·</span> type to search
        </span>
      </footer>
      {toast && <div className="toast">{toast}</div>}
      <TransferBanner transfers={transfers} />
      <style>{shellCss}</style>
    </div>
  );
}

function ConnIndicator({ conn, onPair }: { conn: ConnStatus; onPair: () => void }) {
  if (conn.state === 'unpaired') {
    return (
      <span className="conn">
        <Smartphone size={11} strokeWidth={2} />
        No device paired ·{' '}
        <a className="pair-link" onClick={onPair}>Pair phone <ArrowRight size={11} strokeWidth={2.2} /></a>
      </span>
    );
  }
  if (conn.state === 'connecting') {
    return (
      <span className="conn">
        <Smartphone size={11} strokeWidth={2} />
        Connecting to {conn.deviceName ?? 'phone'}…
      </span>
    );
  }
  if (conn.state === 'connected') {
    return (
      <span className="conn">
        <Smartphone size={11} strokeWidth={2} />
        <span className="dev-name">{conn.deviceName}</span>
        <Zap size={11} strokeWidth={2.2} className="zap" />
      </span>
    );
  }
  return (
    <span className="conn offline">
      <WifiOff size={11} strokeWidth={2} />
      {conn.deviceName ?? 'phone'} (offline)
    </span>
  );
}

const shellCss = `
  .panel {
    display: flex; flex-direction: column; height: 100%;
    background: var(--cm-panel-scrim);
    backdrop-filter: blur(24px) saturate(140%);
    border-radius: var(--cm-radius-panel) var(--cm-radius-panel) 0 0;
    border: 1px solid var(--cm-border-subtle);
    border-bottom: none;
    color: var(--cm-text); overflow: hidden;
  }
  header {
    display: flex; align-items: center; gap: 14px;
    height: 48px; padding: 0 16px;
    border-bottom: 1px solid var(--cm-border-subtle); flex-shrink: 0;
    white-space: nowrap;
  }
  header .brand {
    font-weight: 600; font-size: 13px; color: var(--cm-text);
    letter-spacing: -0.2px; flex-shrink: 0;
  }
  header .chips {
    display: flex; gap: 6px; flex: 1; overflow: hidden; min-width: 0; align-items: center;
  }
  .settings-btn, .back-btn {
    width: 32px; height: 32px; border-radius: 8px;
    background: transparent; border: none;
    color: var(--cm-text-secondary); cursor: pointer; font-size: 16px;
    display: inline-flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .settings-btn:hover, .back-btn:hover { background: var(--cm-surface-raised); color: var(--cm-text); }
  .back-btn { font-size: 18px; }
  main { flex: 1; min-height: 0; position: relative; }
  footer {
    height: 28px; padding: 0 20px; display: flex; align-items: center; gap: 10px;
    border-top: 1px solid var(--cm-border-subtle);
    font-size: 11px; color: var(--cm-text-tertiary);
    font-family: 'Geist Mono', ui-monospace, monospace;
    background: rgba(0,0,0,.15); flex-shrink: 0;
  }
  footer .dot { opacity: .5; }
  footer .spacer { flex: 1; }
  footer .hints { opacity: .8; display: inline-flex; align-items: center; gap: 5px; }
  footer .hints .dot { opacity: .4; }
  footer .pair-link svg { vertical-align: -1px; }
  footer .conn svg { vertical-align: -1px; }
  footer .conn .dev-name { color: var(--cm-text); font-weight: 500; }
  footer .conn .zap { color: var(--cm-accent); }
  .toast {
    position: fixed; bottom: 56px; left: 50%; transform: translateX(-50%);
    background: var(--cm-surface-raised); color: var(--cm-text);
    border: 1px solid var(--cm-border-strong); padding: 8px 14px;
    border-radius: 999px; font-size: 12px; font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,.35); z-index: 9999;
    animation: toast-in 150ms ease-out;
  }
  @keyframes toast-in {
    from { opacity: 0; transform: translateX(-50%) translateY(6px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  footer .conn { display: inline-flex; align-items: center; gap: 6px; }
  footer .conn .dot.live {
    width: 6px; height: 6px; border-radius: 3px;
    background: var(--cm-accent); display: inline-block;
  }
  footer .pair-link { color: var(--cm-accent); text-decoration: underline; cursor: pointer; }
`;
