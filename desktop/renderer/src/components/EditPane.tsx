import { useEffect, useState } from 'react';
import { CornerDownLeft } from 'lucide-react';
import type { ClipDto } from '../../../electron/ipc-types';

export function EditPane({
  clip,
  onSave,
  onCancel,
}: {
  clip: ClipDto;
  onSave: (newId: number, pasteAfter: boolean) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(clip.preview);
  const editable = ['text', 'link', 'code', 'color', 'emoji'].includes(clip.contentType);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        save(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  async function save(paste: boolean) {
    if (!editable) return;
    const newId = await window.clippy.saveEditedClip(clip.id, value);
    onSave(newId, paste);
  }

  if (!editable) {
    return (
      <div className="not-editable">Edit not available for {clip.contentType} clips.</div>
    );
  }
  return (
    <div className="edit-pane">
      <div className="head">
        <span
          className="badge"
          style={{
            background: `var(--badge-${clip.contentType}-bg)`,
            color: `var(--badge-${clip.contentType}-fg)`,
          }}
        >
          {clip.contentType.toUpperCase()}
        </span>
        <span className="meta">
          {clip.sourceApp ?? ''} · {new Date(clip.createdAt).toLocaleString()}
        </span>
      </div>
      <textarea
        className={clip.contentType === 'code' ? 'mono' : ''}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
      />
      <div className="actions">
        <button type="button" className="cancel" onClick={onCancel}>Cancel</button>
        <button type="button" className="save" onClick={() => save(false)}>Save</button>
        <button type="button" className="save-paste" onClick={() => save(true)}>
          Save & Paste · Ctrl+<CornerDownLeft size={11} strokeWidth={2.2} style={{ verticalAlign: '-2px' }} />
        </button>
      </div>
      <style>{editCss}</style>
    </div>
  );
}

const editCss = `
  .edit-pane {
    display: flex; flex-direction: column; gap: 12px;
    padding: 20px; height: 100%;
  }
  .edit-pane .head { display: flex; align-items: center; justify-content: space-between; }
  .edit-pane .badge {
    padding: 3px 7px; border-radius: 6px; font-size: 10px; font-weight: 600;
    letter-spacing: 0.4px; text-transform: uppercase;
  }
  .edit-pane .meta {
    font-size: 11px; color: var(--cm-text-tertiary);
    font-family: 'Geist Mono', ui-monospace, monospace;
  }
  .edit-pane textarea {
    flex: 1; resize: none; border-radius: 10px;
    border: 1px solid var(--cm-border-subtle);
    background: var(--cm-surface-sunken);
    color: var(--cm-text); padding: 12px;
    font-family: inherit; font-size: 14px; line-height: 1.5; outline: none;
  }
  .edit-pane textarea.mono { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 13px; }
  .edit-pane textarea:focus { border-color: var(--cm-accent); }
  .edit-pane .actions { display: flex; gap: 8px; justify-content: flex-end; }
  .edit-pane button {
    padding: 7px 14px; border-radius: 8px; font-family: inherit;
    font-size: 12px; font-weight: 500; cursor: pointer;
    border: 1px solid var(--cm-border-subtle);
    background: transparent; color: var(--cm-text-secondary);
  }
  .edit-pane button.save {
    background: var(--cm-surface-raised); color: var(--cm-text);
    border-color: var(--cm-border-strong);
  }
  .edit-pane button.save-paste {
    background: var(--cm-accent); color: white; border: none;
  }
  .not-editable { padding: 40px; text-align: center; color: var(--cm-text-secondary); }
`;
