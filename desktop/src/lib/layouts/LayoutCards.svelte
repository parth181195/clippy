<script lang="ts">
  import ClipCard from '../components/ClipCard.svelte';
  import type { ClipDto } from '../api';

  let {
    clips,
    selectedHash,
    density = 'comfortable',
    onSelect = (_h: string) => {},
  }: {
    clips: ClipDto[];
    selectedHash: string | null;
    density?: 'compact' | 'comfortable' | 'spacious';
    onSelect?: (hash: string) => void;
  } = $props();
</script>

<div class="cards-row">
  {#each clips as clip (clip.id)}
    <ClipCard
      {clip}
      {density}
      state={clip.hash === selectedHash ? 'selected' : 'default'}
      onSelect={() => onSelect(clip.hash)}
    />
  {/each}
  <div class="edge-fade"></div>
</div>

<style>
  .cards-row {
    display: flex;
    gap: 12px;
    padding: 16px 20px;
    overflow-x: auto;
    overflow-y: hidden;
    height: 100%;
    align-items: stretch;
    scroll-snap-type: x mandatory;
  }
  .cards-row > :global(.card) {
    scroll-snap-align: start;
  }
  .edge-fade {
    position: sticky;
    right: 0;
    top: 0;
    bottom: 0;
    width: 60px;
    pointer-events: none;
    background: linear-gradient(to left, var(--cm-panel-scrim), transparent);
    flex-shrink: 0;
  }
</style>
