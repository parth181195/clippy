import type { ReactNode } from 'react';
import { ClipCard } from '../components/ClipCard';
import type { ClipDto } from '../../../electron/ipc-types';

export function LayoutSpotlight({
  clips,
  selectedHash,
  onSelect,
  focusOverride = null,
}: {
  clips: ClipDto[];
  selectedHash: string | null;
  onSelect: (hash: string) => void;
  focusOverride?: ReactNode | null;
}) {
  const selected = clips.find((c) => c.hash === selectedHash) ?? clips[0];
  const thumbs = clips.filter((c) => c.hash !== selected?.hash);

  let focus: ReactNode = null;
  if (focusOverride) {
    focus = focusOverride;
  } else if (selected) {
    let body: ReactNode;
    if (selected.contentType === 'code') {
      body = <pre>{selected.preview}</pre>;
    } else if (selected.contentType === 'link') {
      body = (
        <div className="link-card">
          <div className="favicon" />
          <div>
            <div className="url">{selected.preview}</div>
            <div className="title">{selected.preview}</div>
            <div className="og-placeholder">preview · open-graph thumbnail</div>
          </div>
        </div>
      );
    } else if (selected.contentType === 'image') {
      body = <div className="image-large" />;
    } else if (selected.contentType === 'color') {
      body = (
        <>
          <div className="color-large" style={{ background: selected.preview }} />
          <div className="color-text">{selected.preview}</div>
        </>
      );
    } else if (selected.contentType === 'emoji') {
      body = <div className="emoji-large">{selected.preview}</div>;
    } else {
      body = <div className="text-large">{selected.preview}</div>;
    }
    focus = (
      <>
        <div className="badge-row">
          <span
            className="badge"
            style={{
              background: `var(--badge-${selected.contentType}-bg)`,
              color: `var(--badge-${selected.contentType}-fg)`,
            }}
          >
            {selected.contentType.toUpperCase()}
          </span>
          <span className="hint">↵ paste</span>
        </div>
        <div className="focus-content">{body}</div>
        <div className="meta">
          {selected.sourceApp && <span>{selected.sourceApp}</span>}
          <span className="spacer" />
          <span>copied {Math.floor((Date.now() - selected.createdAt) / 1000)}s ago</span>
        </div>
      </>
    );
  } else {
    focus = <div className="empty">No clip focused</div>;
  }

  return (
    <div className="spotlight">
      <div className="focus">{focus}</div>
      <div className="thumbs">
        {thumbs.map((clip) => (
          <ClipCard
            key={clip.id}
            clip={clip}
            density="compact"
            onSelect={() => onSelect(clip.hash)}
            state={clip.hash === selectedHash ? 'selected' : 'default'}
          />
        ))}
      </div>
      <style>{spotlightCss}</style>
    </div>
  );
}

const spotlightCss = `
  .spotlight { display: flex; height: 100%; }
  .focus {
    width: 480px; padding: 24px;
    border-right: 1px solid var(--cm-border-subtle);
    background: rgba(0,0,0,.18);
    display: flex; flex-direction: column; gap: 14px; min-height: 0;
  }
  .badge-row { display: flex; align-items: center; justify-content: space-between; }
  .badge {
    padding: 3px 7px; border-radius: 6px; font-size: 10px; font-weight: 600;
    letter-spacing: 0.4px; text-transform: uppercase;
  }
  .hint { font-size: 11px; color: var(--cm-text-secondary); }
  .focus-content { flex: 1; overflow: hidden; min-height: 0; }
  .focus pre {
    margin: 0; font-family: 'Geist Mono', ui-monospace, monospace;
    font-size: 13px; line-height: 1.55; color: var(--cm-text);
    white-space: pre; overflow: hidden;
  }
  .focus .text-large { font-size: 14px; color: var(--cm-text); line-height: 1.55; white-space: pre-wrap; }
  .link-card { display: flex; flex-direction: column; gap: 14px; }
  .link-card .favicon { width: 26px; height: 26px; border-radius: 6px; background: var(--cm-accent); }
  .link-card .url {
    font-size: 12px; color: var(--cm-text-secondary);
    font-family: 'Geist Mono', ui-monospace, monospace;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .link-card .title { font-size: 15px; color: var(--cm-text); font-weight: 500; }
  .link-card .og-placeholder {
    margin-top: 8px; padding: 16px; border-radius: 10px;
    background: linear-gradient(135deg, color-mix(in srgb, var(--cm-accent) 22%, transparent), var(--cm-surface-raised));
    color: var(--cm-text-tertiary);
    font-family: 'Geist Mono', ui-monospace, monospace;
    font-size: 10px; text-align: center;
  }
  .image-large {
    flex: 1; border-radius: 10px;
    background: linear-gradient(135deg, color-mix(in srgb, var(--cm-accent) 22%, transparent), var(--cm-surface-raised));
  }
  .color-large { flex: 1; border-radius: 10px; }
  .color-text { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; color: var(--cm-text); }
  .emoji-large { flex: 1; display: flex; align-items: center; justify-content: center; font-size: 120px; }
  .meta {
    padding-top: 10px; border-top: 1px solid var(--cm-border-subtle);
    display: flex; gap: 10px; font-size: 11px; color: var(--cm-text-tertiary);
    font-family: 'Geist Mono', ui-monospace, monospace;
  }
  .meta .spacer { flex: 1; }
  .focus .empty { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--cm-text-tertiary); }
  .thumbs { flex: 1; display: flex; gap: 8px; padding: 14px 16px; overflow-x: auto; align-items: stretch; }
`;
