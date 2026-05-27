<script lang="ts">
  import ClipCard from '../components/ClipCard.svelte';
  import type { ClipDto } from '../api';
  import type { Snippet } from 'svelte';

  let {
    clips,
    selectedHash,
    onSelect = (_h: string) => {},
    focusOverride = null as Snippet | null,
  }: {
    clips: ClipDto[];
    selectedHash: string | null;
    onSelect?: (hash: string) => void;
    focusOverride?: Snippet | null;
  } = $props();
  const selected = $derived(clips.find((c) => c.hash === selectedHash) ?? clips[0]);
  const thumbs = $derived(clips.filter((c) => c.hash !== selected?.hash));
</script>

<div class="spotlight">
  <div class="focus">
    {#if focusOverride}
      {@render focusOverride()}
    {:else if selected}
      <div class="badge-row">
        <span
          class="badge"
          style:background={`var(--badge-${selected.content_type}-bg)`}
          style:color={`var(--badge-${selected.content_type}-fg)`}
        >
          {selected.content_type.toUpperCase()}
        </span>
        <span class="hint">↵ paste</span>
      </div>
      <div class="focus-content">
        {#if selected.content_type === 'code'}
          <pre>{selected.preview}</pre>
        {:else if selected.content_type === 'link'}
          <div class="link-card">
            <div class="favicon"></div>
            <div>
              <div class="url">{selected.preview}</div>
              <div class="title">{selected.preview}</div>
              <div class="og-placeholder">preview · open-graph thumbnail</div>
            </div>
          </div>
        {:else if selected.content_type === 'image'}
          <div class="image-large"></div>
        {:else if selected.content_type === 'color'}
          <div class="color-large" style:background={selected.preview}></div>
          <div class="color-text">{selected.preview}</div>
        {:else if selected.content_type === 'emoji'}
          <div class="emoji-large">{selected.preview}</div>
        {:else}
          <div class="text-large">{selected.preview}</div>
        {/if}
      </div>
      <div class="meta">
        {#if selected.source_app}<span>{selected.source_app}</span>{/if}
        <span class="spacer"></span>
        <span>copied {Math.floor((Date.now() - selected.created_at) / 1000)}s ago</span>
      </div>
    {:else}
      <div class="empty">No clip focused</div>
    {/if}
  </div>
  <div class="thumbs">
    {#each thumbs as clip (clip.id)}
      <ClipCard
        {clip}
        density="compact"
        onSelect={() => onSelect(clip.hash)}
        state={clip.hash === selectedHash ? 'selected' : 'default'}
      />
    {/each}
  </div>
</div>

<style>
  .spotlight {
    display: flex;
    height: 100%;
  }
  .focus {
    width: 480px;
    padding: 24px;
    border-right: 1px solid var(--cm-border-subtle);
    background: rgba(0, 0, 0, 0.18);
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-height: 0;
  }
  .badge-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .badge {
    padding: 3px 7px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.4px;
    text-transform: uppercase;
  }
  .hint {
    font-size: 11px;
    color: var(--cm-text-secondary);
  }
  .focus-content {
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }
  pre {
    margin: 0;
    font-family: 'Geist Mono', ui-monospace, monospace;
    font-size: 13px;
    line-height: 1.55;
    color: var(--cm-text);
    white-space: pre;
    overflow: hidden;
  }
  .text-large {
    font-size: 14px;
    color: var(--cm-text);
    line-height: 1.55;
    white-space: pre-wrap;
  }
  .link-card {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .favicon {
    width: 26px;
    height: 26px;
    border-radius: 6px;
    background: var(--cm-accent);
  }
  .url {
    font-size: 12px;
    color: var(--cm-text-secondary);
    font-family: 'Geist Mono', ui-monospace, monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .title {
    font-size: 15px;
    color: var(--cm-text);
    font-weight: 500;
  }
  .og-placeholder {
    margin-top: 8px;
    padding: 16px;
    border-radius: 10px;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--cm-accent) 22%, transparent),
      var(--cm-surface-raised)
    );
    color: var(--cm-text-tertiary);
    font-family: 'Geist Mono', ui-monospace, monospace;
    font-size: 10px;
    text-align: center;
  }
  .image-large {
    flex: 1;
    border-radius: 10px;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--cm-accent) 22%, transparent),
      var(--cm-surface-raised)
    );
  }
  .color-large {
    flex: 1;
    border-radius: 10px;
  }
  .color-text {
    font-family: 'Geist Mono', ui-monospace, monospace;
    font-size: 12px;
    color: var(--cm-text);
  }
  .emoji-large {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 120px;
  }
  .meta {
    padding-top: 10px;
    border-top: 1px solid var(--cm-border-subtle);
    display: flex;
    gap: 10px;
    font-size: 11px;
    color: var(--cm-text-tertiary);
    font-family: 'Geist Mono', ui-monospace, monospace;
  }
  .spacer {
    flex: 1;
  }
  .empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--cm-text-tertiary);
  }
  .thumbs {
    flex: 1;
    display: flex;
    gap: 8px;
    padding: 14px 16px;
    overflow-x: auto;
    align-items: stretch;
  }
</style>
