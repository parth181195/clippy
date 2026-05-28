import { create } from 'zustand';
import type { ClipDto, Settings } from '../../../electron/ipc-types';
import '../clippy.d';

interface ClipsState {
  clips: ClipDto[];
  loading: boolean;
  refresh: (search?: string, contentTypeFilter?: string | null, favoritesOnly?: boolean) => Promise<void>;
  toggleFavorite: (id: number) => Promise<void>;
  togglePin: (id: number) => Promise<void>;
  delete: (id: number, force?: boolean) => Promise<void>;
}

export const useClipsStore = create<ClipsState>((set, get) => ({
  clips: [],
  loading: false,
  refresh: async (search, contentTypeFilter, favoritesOnly = false) => {
    set({ loading: true });
    try {
      const clips = await window.clippy.listClips({
        search: search || null,
        contentTypeFilter: contentTypeFilter ?? null,
        favoritesOnly,
      });
      set({ clips });
    } finally {
      set({ loading: false });
    }
  },
  toggleFavorite: async (id) => {
    await window.clippy.toggleFavorite(id);
    set({
      clips: get().clips.map((c) => (c.id === id ? { ...c, isFavorite: !c.isFavorite } : c)),
    });
  },
  togglePin: async (id) => {
    await window.clippy.togglePin(id);
    const next = get().clips.map((c) => (c.id === id ? { ...c, isPinned: !c.isPinned } : c));
    next.sort(
      (a, b) =>
        Number(b.isPinned) - Number(a.isPinned) ||
        Number(b.isFavorite) - Number(a.isFavorite) ||
        b.createdAt - a.createdAt
    );
    set({ clips: next });
  },
  delete: async (id, force = false) => {
    await window.clippy.deleteClip(id, force);
    set({ clips: get().clips.filter((c) => c.id !== id) });
  },
}));

interface SettingsState {
  s: Settings | null;
  load: () => Promise<void>;
  save: (patch: Partial<Settings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  s: null,
  load: async () => {
    const s = await window.clippy.loadSettings();
    applyTheme(s);
    set({ s });
  },
  save: async (patch) => {
    const cur = get().s;
    if (!cur) return;
    const next = { ...cur, ...patch };
    await window.clippy.saveSettings(next);
    applyTheme(next);
    set({ s: next });
  },
}));

function applyTheme(s: Settings): void {
  const theme =
    s.theme === 'auto'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : s.theme;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.setProperty('--cm-accent', s.accent);
  // Push the resolved theme + accent to the paired phone so it matches.
  window.clippy.syncTheme?.(theme, s.accent).catch(() => {});
}

interface FilterState {
  search: string;
  type: string | null;
  favoritesOnly: boolean;
  setSearch: (v: string) => void;
  setType: (v: string | null) => void;
  setFavoritesOnly: (v: boolean) => void;
  cycleType: () => void;
  cycleTypeReverse: () => void;
}

const TYPE_ORDER: (string | null)[] = [null, 'text', 'image', 'link', 'code', 'color', 'emoji', 'file'];

export const useFilterStore = create<FilterState>((set, get) => ({
  search: '',
  type: null,
  favoritesOnly: false,
  setSearch: (v) => set({ search: v }),
  setType: (v) => set({ type: v }),
  setFavoritesOnly: (v) => set({ favoritesOnly: v }),
  cycleType: () => {
    const i = TYPE_ORDER.indexOf(get().type);
    set({ type: TYPE_ORDER[(i + 1) % TYPE_ORDER.length] });
  },
  cycleTypeReverse: () => {
    const i = TYPE_ORDER.indexOf(get().type);
    set({ type: TYPE_ORDER[(i - 1 + TYPE_ORDER.length) % TYPE_ORDER.length] });
  },
}));

interface SelectionState {
  hash: string | null;
  setByHash: (h: string | null) => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  hash: null,
  setByHash: (h) => set({ hash: h }),
}));
