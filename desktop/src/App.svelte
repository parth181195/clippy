<script lang="ts">
  import './app.css';
  import './lib/tokens.css';
  import PanelLayout from './lib/components/PanelLayout.svelte';
  import SearchBar from './lib/components/SearchBar.svelte';
  import FilterChip from './lib/components/FilterChip.svelte';
  import SettingsView from './lib/components/SettingsView.svelte';
  import EditPane from './lib/components/EditPane.svelte';
  import { clipsStore } from './lib/stores/clips.svelte';
  import { settingsStore } from './lib/stores/settings.svelte';
  import { filterStore } from './lib/stores/filter.svelte';
  import { selectionStore } from './lib/stores/selection.svelte';
  import { onMount } from 'svelte';
  import { api } from './lib/api';
  import { getCurrentWindow } from '@tauri-apps/api/window';

  let mode = $state<'list' | 'settings' | 'edit'>('list');
  let editingId: number | null = $state(null);
  let searchBarRef: ReturnType<typeof SearchBar> | undefined = $state();
  let searchFocused = $state(false);

  onMount(async () => {
    await settingsStore.load();
    await clipsStore.refresh();
  });

  $effect(() => {
    void filterStore.search;
    void filterStore.type;
    void filterStore.favoritesOnly;
    clipsStore.refresh(filterStore.search, filterStore.type ?? undefined, filterStore.favoritesOnly);
  });

  function selectedIndex(): number {
    return clipsStore.clips.findIndex((c) => c.hash === selectionStore.hash);
  }
  function moveSelection(delta: number) {
    const cs = clipsStore.clips;
    if (cs.length === 0) return;
    const cur = Math.max(0, selectedIndex());
    const next = (cur + delta + cs.length) % cs.length;
    selectionStore.setByHash(cs[next].hash);
  }

  async function onKeydown(e: KeyboardEvent) {
    if (mode === 'edit') return;
    if (mode === 'settings') {
      if (e.key === 'Escape') {
        mode = 'list';
        e.preventDefault();
      }
      return;
    }
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
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
      e.shiftKey ? filterStore.cycleTypeReverse() : filterStore.cycleType();
    } else if (e.key === 'Backspace' && !filterStore.search) {
      e.preventDefault();
      filterStore.type = null;
    } else if (e.key === 'Delete') {
      e.preventDefault();
      await deleteSelected(e.shiftKey);
    } else if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      await toggleFavoriteSelected();
    } else if (e.key === 'p' || e.key === 'P') {
      if (!e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        await togglePinSelected();
      }
    } else if (e.key === 'Alt') {
      filterStore.favoritesOnly = !filterStore.favoritesOnly;
    } else if (e.key === 'e' || e.key === 'E') {
      e.preventDefault();
      await openEditor();
    } else if (/^[\w !@#$%^&*()\-=+[\]{};:'",.<>/?]$/.test(e.key)) {
      // typing starts a search
      // (focused-state handles further keystrokes)
    }
  }

  async function pasteSelected(shift: boolean) {
    const c = clipsStore.clips[selectedIndex()];
    if (!c) return;
    // Hide the panel so the previously-focused app receives the synthesised Ctrl+V.
    try {
      await getCurrentWindow().hide();
    } catch {}
    await new Promise((r) => setTimeout(r, 50));
    try {
      await api.pasteById(c.id, shift);
    } catch (e) {
      console.error('paste failed', e);
    }
  }
  async function toggleFavoriteSelected() {
    const c = clipsStore.clips[selectedIndex()];
    if (c) await clipsStore.toggleFavorite(c.id);
  }
  async function togglePinSelected() {
    const c = clipsStore.clips[selectedIndex()];
    if (c) await clipsStore.togglePin(c.id);
  }
  async function deleteSelected(force: boolean) {
    const c = clipsStore.clips[selectedIndex()];
    if (c) await clipsStore.delete(c.id, force);
  }
  async function openEditor() {
    const c = clipsStore.clips[selectedIndex()];
    if (!c) return;
    if (!['text', 'link', 'code', 'color', 'emoji'].includes(c.content_type)) return;
    editingId = c.id;
    mode = 'edit';
  }

  const selectedClipForEdit = $derived(clipsStore.clips.find((c) => c.id === editingId));
</script>

<svelte:window on:keydown={onKeydown} />

<div class="panel">
  <header>
    <SearchBar bind:value={filterStore.search} bind:focused={searchFocused} bind:this={searchBarRef} />
    <div class="chips">
      <FilterChip
        label="All"
        active={filterStore.type === null && !filterStore.favoritesOnly}
        onClick={() => {
          filterStore.type = null;
          filterStore.favoritesOnly = false;
        }}
      />
      <FilterChip
        label="Favorites"
        icon="★"
        active={filterStore.favoritesOnly}
        onClick={() => (filterStore.favoritesOnly = !filterStore.favoritesOnly)}
      />
      {#each ['text', 'image', 'link', 'code', 'color', 'emoji', 'file'] as t}
        <FilterChip
          label={t[0].toUpperCase() + t.slice(1)}
          active={filterStore.type === t}
          onClick={() => (filterStore.type = filterStore.type === t ? null : t)}
        />
      {/each}
    </div>
    <button
      class="settings-btn"
      onclick={() => (mode = mode === 'settings' ? 'list' : 'settings')}
      aria-label="Settings"
      type="button">⚙</button
    >
  </header>

  <main>
    {#if mode === 'settings'}
      <SettingsView />
    {:else if mode === 'edit' && selectedClipForEdit}
      <EditPane
        clip={selectedClipForEdit}
        onSave={() => {
          mode = 'list';
          editingId = null;
          clipsStore.refresh();
        }}
        onCancel={() => {
          mode = 'list';
          editingId = null;
        }}
      />
    {:else if settingsStore.s}
      <PanelLayout
        layout={settingsStore.s.layout as any}
        clips={clipsStore.clips}
        selectedHash={selectionStore.hash}
        density={settingsStore.s.density as any}
        filter={{
          search: filterStore.search,
          type: filterStore.type,
          favoritesOnly: filterStore.favoritesOnly,
        }}
        onSelect={(h) => selectionStore.setByHash(h)}
      />
    {/if}
  </main>

  <footer>
    <span>{clipsStore.clips.length} items</span>
    <span class="dot">·</span>
    <span class="conn">No device paired</span>
    <span class="spacer"></span>
    <span class="hints">↵ paste · ⌫ delete · type to search · Ctrl+F10 toggle</span>
  </footer>
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--cm-panel-scrim);
    backdrop-filter: blur(24px) saturate(140%);
    -webkit-backdrop-filter: blur(24px) saturate(140%);
    border-radius: var(--cm-radius-panel);
    border: 1px solid var(--cm-border-subtle);
    color: var(--cm-text);
    overflow: hidden;
  }
  header {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 48px;
    padding: 0 16px;
    border-bottom: 1px solid var(--cm-border-subtle);
    flex-shrink: 0;
  }
  .chips {
    display: flex;
    gap: 6px;
    flex: 1;
    overflow: hidden;
    min-width: 0;
  }
  .settings-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: transparent;
    border: none;
    color: var(--cm-text-secondary);
    cursor: pointer;
    font-size: 16px;
  }
  main {
    flex: 1;
    min-height: 0;
    position: relative;
  }
  footer {
    height: 28px;
    padding: 0 20px;
    display: flex;
    align-items: center;
    gap: 10px;
    border-top: 1px solid var(--cm-border-subtle);
    font-size: 11px;
    color: var(--cm-text-tertiary);
    font-family: 'Geist Mono', ui-monospace, monospace;
    background: rgba(0, 0, 0, 0.15);
    flex-shrink: 0;
  }
  .dot {
    opacity: 0.5;
  }
  .spacer {
    flex: 1;
  }
  .hints {
    opacity: 0.7;
  }
</style>
