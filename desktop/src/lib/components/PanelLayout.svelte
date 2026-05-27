<script lang="ts">
  import LayoutCards from '../layouts/LayoutCards.svelte';
  import LayoutSpotlight from '../layouts/LayoutSpotlight.svelte';
  import LayoutSectioned from '../layouts/LayoutSectioned.svelte';
  import LayoutMosaic from '../layouts/LayoutMosaic.svelte';
  import EmptyState from './EmptyState.svelte';
  import type { ClipDto } from '../api';
  import type { Snippet } from 'svelte';

  let {
    layout,
    clips,
    selectedHash,
    density,
    filter,
    onSelect,
    focusOverride = null as Snippet | null,
  }: {
    layout: 'cards' | 'spotlight' | 'sectioned' | 'mosaic';
    clips: ClipDto[];
    selectedHash: string | null;
    density: 'compact' | 'comfortable' | 'spacious';
    filter: { search: string; type: string | null; favoritesOnly: boolean };
    onSelect: (hash: string) => void;
    focusOverride?: Snippet | null;
  } = $props();
</script>

{#if clips.length === 0}
  {#if filter.search}
    <EmptyState variant="no-results" search={filter.search} />
  {:else if filter.type}
    <EmptyState variant="no-filter" />
  {:else}
    <EmptyState variant="no-history" />
  {/if}
{:else if layout === 'cards'}
  <LayoutCards {clips} {selectedHash} {density} {onSelect} />
{:else if layout === 'spotlight'}
  <LayoutSpotlight {clips} {selectedHash} {onSelect} {focusOverride} />
{:else if layout === 'sectioned'}
  <LayoutSectioned {clips} {selectedHash} {onSelect} searchActive={!!filter.search} />
{:else if layout === 'mosaic'}
  <LayoutMosaic {clips} {selectedHash} {onSelect} filterActive={!!filter.type} />
{/if}
