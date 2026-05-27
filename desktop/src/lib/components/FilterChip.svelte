<script lang="ts">
  let {
    label,
    active = false,
    icon = '',
    count = null as number | null,
    onClick = () => {},
  }: {
    label: string;
    active?: boolean;
    icon?: string;
    count?: number | null;
    onClick?: () => void;
  } = $props();
</script>

<button class="chip" class:active onclick={onClick} type="button">
  {#if icon}<span class="icon">{icon}</span>{/if}
  <span>{label}</span>
  {#if count !== null}<span class="count">{count}</span>{/if}
</button>

<style>
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 11px;
    background: transparent;
    color: var(--cm-text-secondary);
    border: 1px solid var(--cm-border-subtle);
    border-radius: 14px;
    font-size: 12px;
    font-weight: 500;
    font-family: inherit;
    white-space: nowrap;
    cursor: pointer;
  }
  .chip.active {
    background: var(--cm-surface-raised);
    color: var(--cm-text);
    border-color: var(--cm-border-strong);
  }
  .count {
    font-size: 10px;
    color: var(--cm-text-tertiary);
    font-family: 'Geist Mono', ui-monospace, monospace;
  }
</style>
