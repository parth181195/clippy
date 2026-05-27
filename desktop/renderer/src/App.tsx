import { useEffect, useRef, useState } from 'react';
import { PanelLayout } from './components/PanelLayout';
import { SearchBar, type SearchBarHandle } from './components/SearchBar';
import { FilterChip } from './components/FilterChip';
import { SettingsView } from './components/SettingsView';
import { EditPane } from './components/EditPane';
import {
  useClipsStore,
  useFilterStore,
  useSelectionStore,
  useSettingsStore,
} from './lib/store';
import './clippy.d';

type Mode = 'list' | 'settings' | 'edit';

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
  const searchRef = useRef<SearchBarHandle>(null);

  // Initial load
  useEffect(() => {
    void loadSettings();
    void refresh().then(() => {
      const first = useClipsStore.getState().clips[0];
      if (first && !useSelectionStore.getState().hash) setByHash(first.hash);
    });
    // Subscribe to clip-new events from main
    const off = window.clippy.onClipNew(() => {
      void refresh(filter.search, filter.type, filter.favoritesOnly);
    });
    return off;
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
      } else if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
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
      <div className="drag-handle" />
      <header>
        <SearchBar
          ref={searchRef}
          value={filter.search}
          onChange={(v) => filter.setSearch(v)}
        />
        <div className="chips">
          <FilterChip
            label="All"
            active={filter.type === null && !filter.favoritesOnly}
            onClick={() => {
              filter.setType(null);
              filter.setFavoritesOnly(false);
            }}
          />
          <FilterChip
            label="Favorites"
            icon="★"
            active={filter.favoritesOnly}
            onClick={() => filter.setFavoritesOnly(!filter.favoritesOnly)}
          />
          {TYPES.map((t) => (
            <FilterChip
              key={t}
              label={t[0].toUpperCase() + t.slice(1)}
              active={filter.type === t}
              onClick={() => filter.setType(filter.type === t ? null : t)}
            />
          ))}
        </div>
        <button
          className="settings-btn"
          onClick={() => setMode(mode === 'settings' ? 'list' : 'settings')}
          aria-label="Settings"
          type="button"
        >
          ⚙
        </button>
      </header>
      <main>
        {mode === 'settings' ? (
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
          />
        ) : null}
      </main>
      <footer>
        <span>{clips.length} items</span>
        <span className="dot">·</span>
        <span className="conn">No device paired</span>
        <span className="spacer" />
        <span className="hints">
          ↵ paste · ⌫ delete · type to search · Ctrl+Shift+F11 open · Ctrl+Alt+V paste-last
        </span>
      </footer>
      <style>{shellCss}</style>
    </div>
  );
}

const shellCss = `
  .panel {
    display: flex; flex-direction: column; height: 100%;
    background: var(--cm-panel-scrim);
    backdrop-filter: blur(24px) saturate(140%);
    border-radius: var(--cm-radius-panel);
    border: 1px solid var(--cm-border-subtle);
    color: var(--cm-text); overflow: hidden;
  }
  .drag-handle {
    -webkit-app-region: drag;
    height: 10px; width: 100%; flex-shrink: 0;
    background: linear-gradient(180deg, rgba(255,255,255,.04), transparent);
  }
  header {
    display: flex; align-items: center; gap: 10px;
    height: 48px; padding: 0 16px;
    border-bottom: 1px solid var(--cm-border-subtle); flex-shrink: 0;
  }
  header .chips {
    display: flex; gap: 6px; flex: 1; overflow: hidden; min-width: 0;
  }
  .settings-btn {
    width: 32px; height: 32px; border-radius: 8px;
    background: transparent; border: none;
    color: var(--cm-text-secondary); cursor: pointer; font-size: 16px;
  }
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
  footer .hints { opacity: .7; }
`;
