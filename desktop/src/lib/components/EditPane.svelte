<script lang="ts">
  import { api, type ClipDto } from '../api';
  let {
    clip,
    onSave = (_id: number, _pasteAfter: boolean) => {},
    onCancel = () => {},
  }: {
    clip: ClipDto;
    onSave?: (newId: number, pasteAfter: boolean) => void;
    onCancel?: () => void;
  } = $props();
  let value = $state(clip.preview);
  const editable = $derived(['text', 'link', 'code', 'color', 'emoji'].includes(clip.content_type));

  async function save(paste: boolean) {
    if (!editable) return;
    const newId = await api.saveEditedClip(clip.id, value);
    onSave(newId, paste);
  }
  function keydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      save(true);
    }
  }
</script>

{#if !editable}
  <div class="not-editable">Edit not available for {clip.content_type} clips.</div>
{:else}
  <div
    class="edit-pane"
    role="dialog"
    aria-label="Edit clip"
    tabindex="-1"
    onkeydown={keydown}
  >
    <div class="head">
      <span
        class="badge"
        style:background={`var(--badge-${clip.content_type}-bg)`}
        style:color={`var(--badge-${clip.content_type}-fg)`}
      >
        {clip.content_type.toUpperCase()}
      </span>
      <span class="meta">{clip.source_app ?? ''} · {new Date(clip.created_at).toLocaleString()}</span>
    </div>
    <textarea bind:value class:mono={clip.content_type === 'code'}></textarea>
    <div class="actions">
      <button type="button" class="cancel" onclick={onCancel}>Cancel</button>
      <button type="button" class="save" onclick={() => save(false)}>Save</button>
      <button type="button" class="save-paste" onclick={() => save(true)}
        >Save &amp; Paste · Ctrl+↵</button
      >
    </div>
  </div>
{/if}

<style>
  .edit-pane {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 20px;
    height: 100%;
  }
  .head {
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
  .meta {
    font-size: 11px;
    color: var(--cm-text-tertiary);
    font-family: 'Geist Mono', ui-monospace, monospace;
  }
  textarea {
    flex: 1;
    resize: none;
    border-radius: 10px;
    border: 1px solid var(--cm-border-subtle);
    background: var(--cm-surface-sunken);
    color: var(--cm-text);
    padding: 12px;
    font-family: inherit;
    font-size: 14px;
    line-height: 1.5;
    outline: none;
  }
  textarea.mono {
    font-family: 'Geist Mono', ui-monospace, monospace;
    font-size: 13px;
  }
  textarea:focus {
    border-color: var(--cm-accent);
  }
  .actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
  button {
    padding: 7px 14px;
    border-radius: 8px;
    font-family: inherit;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid var(--cm-border-subtle);
    background: transparent;
    color: var(--cm-text-secondary);
  }
  button.save {
    background: var(--cm-surface-raised);
    color: var(--cm-text);
    border-color: var(--cm-border-strong);
  }
  button.save-paste {
    background: var(--cm-accent);
    color: white;
    border: none;
  }
  .not-editable {
    padding: 40px;
    text-align: center;
    color: var(--cm-text-secondary);
  }
</style>
