<script lang="ts" module>
  export function relTime(ms: number): string {
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
    clip,
    state = 'default',
    density = 'comfortable',
    onSelect = () => {},
  }: {
    clip: ClipDto;
    state?: 'default' | 'hover' | 'selected' | 'pressed';
    density?: 'compact' | 'comfortable' | 'spacious';
    onSelect?: () => void;
  } = $props();

  const sizes = {
    compact: { w: 168, h: 210, pad: 10, gap: 8 },
    comfortable: { w: 200, h: 240, pad: 12, gap: 10 },
    spacious: { w: 232, h: 244, pad: 16, gap: 14 },
  };
  const s = $derived(sizes[density]);
</script>

<button
  class="card state-{state} type-{clip.content_type}"
  style:width="{s.w}px"
  style:height="{s.h}px"
  style:padding="{s.pad}px"
  style:gap="{s.gap}px"
  onclick={onSelect}
  type="button"
>
  {#if clip.is_pinned}
    <span class="pin-stripe"></span>
  {/if}

  <div class="top">
    <span
      class="badge"
      style:background={`var(--badge-${clip.content_type}-bg)`}
      style:color={`var(--badge-${clip.content_type}-fg)`}
    >
      {clip.content_type.toUpperCase()}
    </span>
    {#if clip.source_app}<span class="source">{clip.source_app}</span>{/if}
  </div>

  <div class="content">
    {#if clip.content_type === 'image'}
      <div class="image-thumb"></div>
    {:else if clip.content_type === 'color'}
      <div class="color-swatch" style:background={clip.preview}></div>
      <div class="color-text">{clip.preview}</div>
    {:else if clip.content_type === 'emoji'}
      <div class="emoji">{clip.preview}</div>
    {:else if clip.content_type === 'code'}
      <pre class="code">{clip.preview}</pre>
    {:else}
      <div class="text">{clip.preview}</div>
    {/if}
  </div>

  <div class="bottom">
    <span class="time">{relTime(clip.created_at)}</span>
    {#if clip.is_favorite}<span class="star">★</span>{:else}<span class="star empty">☆</span>{/if}
  </div>
</button>

<style>
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    background: var(--cm-surface);
    border: 1px solid var(--cm-border-subtle);
    border-radius: var(--cm-radius-card);
    color: var(--cm-text);
    transition: transform var(--cm-transition), background var(--cm-transition),
      border-color var(--cm-transition);
    flex-shrink: 0;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
  }
  .card.state-hover {
    background: var(--cm-surface-raised);
    border-color: color-mix(in srgb, var(--cm-accent) 33%, transparent);
    transform: translateY(-2px);
  }
  .card.state-selected {
    background: var(--cm-surface-raised);
    border-color: var(--cm-accent);
  }
  .card.state-pressed {
    transform: scale(0.97);
  }
  .pin-stripe {
    position: absolute;
    top: 0;
    left: 14px;
    right: 14px;
    height: 2px;
    background: var(--cm-accent);
    border-bottom-left-radius: 1px;
    border-bottom-right-radius: 1px;
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 18px;
  }
  .badge {
    padding: 3px 7px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.4px;
    line-height: 1;
    text-transform: uppercase;
  }
  .source {
    font-size: 10px;
    color: var(--cm-text-tertiary);
    font-family: 'Geist Mono', ui-monospace, monospace;
  }
  .content {
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }
  .text,
  .code {
    font-size: 13px;
    line-height: 1.5;
    color: var(--cm-text);
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 7;
    -webkit-box-orient: vertical;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .code {
    font-family: 'Geist Mono', ui-monospace, monospace;
    font-size: 11.5px;
    line-height: 1.45;
    white-space: pre;
    -webkit-line-clamp: 8;
  }
  .image-thumb {
    width: 100%;
    height: 100%;
    border-radius: 8px;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--cm-accent) 20%, var(--cm-surface-raised)) 0%,
      var(--cm-surface-raised) 60%
    );
  }
  .color-swatch {
    flex: 1;
    border-radius: 8px;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
  }
  .color-text {
    font-family: 'Geist Mono', ui-monospace, monospace;
    font-size: 11px;
    color: var(--cm-text-secondary);
  }
  .emoji {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 64px;
    line-height: 1;
  }
  .bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 16px;
  }
  .time {
    font-size: 10px;
    color: var(--cm-text-tertiary);
    font-family: 'Geist Mono', ui-monospace, monospace;
    letter-spacing: 0.3px;
  }
  .star {
    font-size: 14px;
    color: var(--cm-accent);
  }
  .star.empty {
    color: var(--cm-text-tertiary);
  }
</style>
