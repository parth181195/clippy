import { api, type ClipDto } from '../api';

class ClipsStore {
  clips = $state<ClipDto[]>([]);
  loading = $state(false);
  async refresh(search?: string, contentTypeFilter?: string, favoritesOnly = false) {
    this.loading = true;
    try {
      this.clips = await api.listClips({
        search,
        content_type_filter: contentTypeFilter,
        favorites_only: favoritesOnly,
      });
    } finally {
      this.loading = false;
    }
  }
  async toggleFavorite(id: number) {
    await api.toggleFavorite(id);
    const c = this.clips.find((c) => c.id === id);
    if (c) c.is_favorite = !c.is_favorite;
  }
  async togglePin(id: number) {
    await api.togglePin(id);
    const c = this.clips.find((c) => c.id === id);
    if (c) c.is_pinned = !c.is_pinned;
    this.clips = [...this.clips].sort(
      (a, b) =>
        Number(b.is_pinned) - Number(a.is_pinned) ||
        Number(b.is_favorite) - Number(a.is_favorite) ||
        b.created_at - a.created_at
    );
  }
  async delete(id: number, force = false) {
    await api.deleteClip(id, force);
    this.clips = this.clips.filter((c) => c.id !== id);
  }
}
export const clipsStore = new ClipsStore();
