<script lang="ts">
  let {
    value = $bindable(''),
    placeholder = 'Search clipboard…',
    focused = $bindable(false),
    onClear = () => {},
  }: {
    value?: string;
    placeholder?: string;
    focused?: boolean;
    onClear?: () => void;
  } = $props();
  let inputRef: HTMLInputElement | undefined = $state();
  export function focus() {
    inputRef?.focus();
  }
</script>

<div class="search" class:focused>
  <span class="icon">🔍</span>
  <input
    bind:this={inputRef}
    bind:value
    type="text"
    {placeholder}
    onfocus={() => (focused = true)}
    onblur={() => (focused = false)}
  />
  {#if value}
    <button
      class="clear"
      onclick={() => {
        value = '';
        onClear();
      }}
      aria-label="Clear"
      type="button">×</button
    >
  {/if}
</div>

<style>
  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 32px;
    padding: 0 12px;
    background: rgba(0, 0, 0, 0.25);
    border-radius: 10px;
    border: 1px solid var(--cm-border-subtle);
    width: 360px;
    transition: border-color 120ms, box-shadow 120ms;
  }
  .search.focused {
    border-color: var(--cm-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--cm-accent) 22%, transparent);
  }
  input {
    flex: 1;
    min-width: 0;
    background: transparent;
    border: none;
    outline: none;
    color: var(--cm-text);
    font-family: inherit;
    font-size: 13px;
  }
  input::placeholder {
    color: var(--cm-text-tertiary);
  }
  .icon {
    color: var(--cm-text-secondary);
    font-size: 14px;
  }
  .clear {
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--cm-text-secondary);
    font-size: 14px;
    padding: 2px;
  }
</style>
