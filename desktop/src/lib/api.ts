import { invoke } from '@tauri-apps/api/core';

export interface ClipDto {
  id: number;
  content_type: 'text' | 'link' | 'code' | 'color' | 'emoji' | 'file' | 'image';
  mime: string;
  hash: string;
  preview: string;
  source_app: string | null;
  is_favorite: boolean;
  is_pinned: boolean;
  created_at: number;
}

export interface Settings {
  theme: string;
  layout: string;
  density: string;
  accent: string;
  panel_position: string;
  hotkey_panel: string;
  hotkey_paste_last: string;
  hotkey_incognito: string;
  history_size: number;
  polling_ms: number;
  sound_on_copy: boolean;
  notifications_on_copy: boolean;
  link_previews_enabled: boolean;
  auto_sync_outgoing: boolean;
  auto_sync_incoming: boolean;
  incognito_auto_disable_secs: number;
}

export const api = {
  listClips: (opts: {
    search?: string;
    content_type_filter?: string;
    favorites_only?: boolean;
    limit?: number;
  } = {}) =>
    invoke<ClipDto[]>('list_clips', {
      search: opts.search ?? null,
      contentTypeFilter: opts.content_type_filter ?? null,
      favoritesOnly: opts.favorites_only ?? false,
      limit: opts.limit ?? 500,
    }),
  getClipContent: (id: number, mime?: string) =>
    invoke<number[]>('get_clip_content', { id, mime: mime ?? null }),
  getThumbnail: (id: number) => invoke<number[] | null>('get_thumbnail', { id }),
  toggleFavorite: (id: number) => invoke<boolean>('toggle_favorite', { id }),
  togglePin: (id: number) => invoke<boolean>('toggle_pin', { id }),
  deleteClip: (id: number, force = false) => invoke<void>('delete_clip', { id, force }),
  saveEditedClip: (originalId: number, newContent: string) =>
    invoke<number>('save_edited_clip', { originalId, newContent }),
  loadSettings: () => invoke<Settings>('load_settings'),
  saveSettings: (s: Settings) => invoke<void>('save_settings', { settings: s }),
};
