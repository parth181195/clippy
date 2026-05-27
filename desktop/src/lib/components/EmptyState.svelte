<script lang="ts">
  let {
    variant,
    search = '',
  }: { variant: 'no-history' | 'no-results' | 'no-filter'; search?: string } = $props();
  const titles = {
    'no-history': 'Nothing here yet',
    'no-results': `No matches for "${search || 'query'}"`,
    'no-filter': 'No clips of this type yet',
  };
  const hints = {
    'no-history': "Copy anything — text, an image, a file — and it'll show up here.",
    'no-results': 'Try a shorter term or a different filter.',
    'no-filter': 'Copy something matching this type to populate this filter.',
  };
</script>

<div class="empty">
  <div class="title">{titles[variant]}</div>
  <div class="hint">{hints[variant]}</div>
</div>

<style>
  .empty {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 20px;
  }
  .title {
    font-size: 14px;
    font-weight: 500;
    color: var(--cm-text);
  }
  .hint {
    font-size: 12px;
    color: var(--cm-text-secondary);
    text-align: center;
    max-width: 360px;
    line-height: 1.5;
  }
</style>
