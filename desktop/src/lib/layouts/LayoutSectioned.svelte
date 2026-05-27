<script lang="ts" module>
  function relTime(ms: number): string {
    const d = Date.now() - ms;
    if (d < 60_000) return 'now';
    if (d < 3_600_000) return `${Math.floor(d / 60_000)}m`;
    if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h`;
    return `${Math.floor(d / 86_400_000)}d`;
  }
</script>

<script lang="ts">
  import type { ClipDto } from '../api';

  let {
    clips,
    selectedHash,
    onSelect = (_h: string) => {},
    searchActive = false,
  }: {
    clips: ClipDto[];
    selectedHash: string | null;
    onSelect?: (h: string) => void;
    searchActive?: boolean;
  } = $props();

  type Group = { label: string; items: ClipDto[] };
  const groups = $derived.by(() => buildGroups(clips, searchActive));

  function buildGroups(cs: ClipDto[], search: boolean): Group[] {
    if (search) return [{ label: `RESULTS · ${cs.length} MATCHES`, items: cs }];
    const pinned = cs.filter((c) => c.is_pinned);
    const others = cs.filter((c) => !c.is_pinned);
    const now = Date.now();
    const today = others.filter((c) => now - c.created_at < 86_400_000);
    const earlier = others.filter((c) => now - c.created_at >= 86_400_000);
    const g: Group[] = [];
    if (pinned.length) g.push({ label: 'PINNED', items: pinned });
    if (today.length) g.push({ label: 'TODAY', items: today });
    if (earlier.length) g.push({ label: 'EARLIER', items: earlier });
    return g;
  }

  function previewText(c: ClipDto): string {
    if (c.content_type === 'image') return 'Screenshot';
    if (c.content_type === 'file') return c.preview;
    return c.preview.split('\n')[0];
  }
</script>

<div class="sectioned">
  {#each groups as g}
    <div class="group">
      <div class="label" class:results={g.label.startsWith('RESULTS')}>{g.label}</div>
      {#each g.items as c (c.id)}
        <button
          class="row"
          class:selected={c.hash === selectedHash}
          onclick={() => onSelect(c.hash)}
          type="button"
        >
          <span
            class="badge"
            style:background={`var(--badge-${c.content_type}-bg)`}
            style:color={`var(--badge-${c.content_type}-fg)`}>{c.content_type.toUpperCase()}</span
          >
          <span class="text">{previewText(c)}</span>
          {#if c.is_favorite}<span class="star">★</span>{/if}
          <span class="time">{relTime(c.created_at)}</span>
        </button>
      {/each}
    </div>
  {/each}
  {#if groups.length === 0}<div class="empty">— nothing —</div>{/if}
</div>

<style>
  .sectioned {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 24px;
    padding: 14px 16px;
    height: 100%;
    overflow: hidden;
  }
  .group {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .label {
    font-size: 10px;
    font-weight: 600;
    color: var(--cm-text-tertiary);
    letter-spacing: 0.8px;
    padding: 0 10px 5px;
    font-family: 'Geist Mono', ui-monospace, monospace;
  }
  .label.results {
    color: var(--cm-accent);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    border-radius: 7px;
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    color: var(--cm-text);
  }
  .row.selected {
    background: var(--cm-surface-raised);
    border-color: var(--cm-accent);
  }
  .badge {
    padding: 3px 7px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 600;
  }
  .text {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .star {
    color: var(--cm-accent);
  }
  .time {
    font-size: 10px;
    color: var(--cm-text-tertiary);
    font-family: 'Geist Mono', ui-monospace, monospace;
    width: 28px;
    text-align: right;
  }
  .empty {
    display: flex;
    align-items: center;
    justify-content: center;
    grid-column: 1 / -1;
    color: var(--cm-text-tertiary);
  }
</style>
