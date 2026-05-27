<script lang="ts">
  import ClipCard from '../components/ClipCard.svelte';
  import type { ClipDto } from '../api';

  let {
    clips,
    selectedHash,
    onSelect = (_h: string) => {},
    filterActive = false,
  }: {
    clips: ClipDto[];
    selectedHash: string | null;
    onSelect?: (h: string) => void;
    filterActive?: boolean;
  } = $props();

  function widthFor(c: ClipDto, isFirstFiltered: boolean): number {
    if (isFirstFiltered) return 320;
    switch (c.content_type) {
      case 'code': return 280;
      case 'image': return 240;
      case 'text': return 220;
      case 'link': return 200;
      case 'file': return 200;
      case 'color': return 160;
      case 'emoji': return 130;
      default: return 200;
    }
  }
</script>

<div class="mosaic">
  {#each clips as c, i (c.id)}
    <div style:width="{widthFor(c, filterActive && i === 0)}px" style:flex-shrink="0">
      <ClipCard
        clip={c}
        density="comfortable"
        state={c.hash === selectedHash ? 'selected' : 'default'}
        onSelect={() => onSelect(c.hash)}
      />
    </div>
  {/each}
</div>

<style>
  .mosaic {
    display: flex;
    gap: 12px;
    padding: 16px 20px;
    overflow-x: auto;
    overflow-y: hidden;
    height: 100%;
    align-items: stretch;
  }
</style>
