import { useEffect, useState } from 'react';
import { Star, Send, Pin, Trash2, Pencil } from 'lucide-react';
import * as Menu from '@radix-ui/react-context-menu';
import type { ClipDto } from '../../../electron/ipc-types';

export type CardState = 'default' | 'hover' | 'selected' | 'pressed';
export type Density = 'compact' | 'comfortable' | 'spacious';

const SIZES: Record<Density, { w: number; h: number; pad: number; gap: number }> = {
  compact: { w: 168, h: 210, pad: 10, gap: 8 },
  comfortable: { w: 200, h: 240, pad: 12, gap: 10 },
  spacious: { w: 232, h: 244, pad: 16, gap: 14 },
};

export function relTime(ms: number): string {
  const d = Date.now() - ms;
  if (d < 60_000) return 'now';
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h`;
  return `${Math.floor(d / 86_400_000)}d`;
}

export interface ClipCardActions {
  onSend?: () => void;
  onToggleFavorite?: () => void;
  onTogglePin?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
}

export function ClipCard({
  clip,
  state = 'default',
  density = 'comfortable',
  onSelect = () => {},
  actions,
  canSend = false,
}: {
  clip: ClipDto;
  state?: CardState;
  density?: Density;
  onSelect?: () => void;
  actions?: ClipCardActions;
  canSend?: boolean;
}) {
  const s = SIZES[density];
  const ct = clip.contentType;

  let content: React.ReactNode;
  if (ct === 'image') content = <ImageThumb id={clip.id} />;
  else if (ct === 'color')
    content = (
      <>
        <div className="color-swatch" style={{ background: clip.preview }} />
        <div className="color-text">{clip.preview}</div>
      </>
    );
  else if (ct === 'emoji') content = <div className="emoji">{clip.preview}</div>;
  else if (ct === 'code') content = <pre className="code">{clip.preview}</pre>;
  else content = <div className="text">{clip.preview}</div>;

  const cardBtn = (
    <button
      type="button"
      className={`card state-${state} type-${ct}`}
      style={{
        width: s.w,
        height: s.h,
        padding: s.pad,
        gap: s.gap,
      }}
      onClick={onSelect}
    >
      {clip.isPinned && <span className="pin-stripe" />}
      <div className="top">
        <span
          className="badge"
          style={{
            background: `var(--badge-${ct}-bg)`,
            color: `var(--badge-${ct}-fg)`,
          }}
        >
          {ct.toUpperCase()}
        </span>
        {clip.sourceApp && <span className="source">{clip.sourceApp}</span>}
      </div>
      <div className="content">{content}</div>
      <div className="bottom">
        <span className="time">{relTime(clip.createdAt)}</span>
        <span className={`star ${clip.isFavorite ? '' : 'empty'}`}>
          <Star size={12} strokeWidth={2} fill={clip.isFavorite ? 'currentColor' : 'none'} />
        </span>
      </div>
      <style>{cardCss}</style>
    </button>
  );

  if (!actions) return cardBtn;

  return (
    <Menu.Root>
      <Menu.Trigger asChild>{cardBtn}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Content className="cm-ctx" collisionPadding={8}>
          {actions.onSend && (
            <Menu.Item
              className="cm-ctx-item"
              disabled={!canSend}
              onSelect={actions.onSend}
            >
              <Send size={13} strokeWidth={2} />
              <span>Send to phone</span>
              <span className="cm-ctx-kbd">⇧⌃S</span>
            </Menu.Item>
          )}
          {actions.onEdit && ['text','link','code','color','emoji'].includes(ct) && (
            <Menu.Item className="cm-ctx-item" onSelect={actions.onEdit}>
              <Pencil size={13} strokeWidth={2} />
              <span>Edit</span>
              <span className="cm-ctx-kbd">E</span>
            </Menu.Item>
          )}
          <Menu.Separator className="cm-ctx-sep" />
          {actions.onToggleFavorite && (
            <Menu.Item className="cm-ctx-item" onSelect={actions.onToggleFavorite}>
              <Star size={13} strokeWidth={2} fill={clip.isFavorite ? 'currentColor' : 'none'} />
              <span>{clip.isFavorite ? 'Unfavorite' : 'Favorite'}</span>
              <span className="cm-ctx-kbd">⌃S</span>
            </Menu.Item>
          )}
          {actions.onTogglePin && (
            <Menu.Item className="cm-ctx-item" onSelect={actions.onTogglePin}>
              <Pin size={13} strokeWidth={2} fill={clip.isPinned ? 'currentColor' : 'none'} />
              <span>{clip.isPinned ? 'Unpin' : 'Pin'}</span>
              <span className="cm-ctx-kbd">P</span>
            </Menu.Item>
          )}
          {actions.onDelete && (
            <>
              <Menu.Separator className="cm-ctx-sep" />
              <Menu.Item className="cm-ctx-item danger" onSelect={actions.onDelete}>
                <Trash2 size={13} strokeWidth={2} />
                <span>Delete</span>
                <span className="cm-ctx-kbd">Del</span>
              </Menu.Item>
            </>
          )}
        </Menu.Content>
      </Menu.Portal>
      <style>{ctxMenuCss}</style>
    </Menu.Root>
  );
}

const ctxMenuCss = `
  .cm-ctx {
    min-width: 200px; padding: 4px;
    background: var(--cm-surface-raised);
    border: 1px solid var(--cm-border-strong);
    border-radius: 10px; box-shadow: 0 8px 28px rgba(0,0,0,.5);
    z-index: 9999; font-family: inherit;
  }
  .cm-ctx-item {
    display: flex; align-items: center; gap: 10px;
    padding: 7px 10px; border-radius: 6px; cursor: pointer;
    font-size: 12.5px; color: var(--cm-text); outline: none;
  }
  .cm-ctx-item span:nth-of-type(1) { flex: 1; }
  .cm-ctx-item .cm-ctx-kbd {
    font-family: 'Geist Mono', ui-monospace, monospace;
    font-size: 10.5px; color: var(--cm-text-tertiary);
  }
  .cm-ctx-item[data-highlighted] { background: var(--cm-accent); color: white; }
  .cm-ctx-item[data-highlighted] .cm-ctx-kbd { color: rgba(255,255,255,.7); }
  .cm-ctx-item[data-disabled] { color: var(--cm-text-tertiary); cursor: not-allowed; }
  .cm-ctx-item.danger { color: #f87171; }
  .cm-ctx-item.danger[data-highlighted] { background: #b91c1c; color: white; }
  .cm-ctx-sep { height: 1px; background: var(--cm-border-subtle); margin: 4px 2px; }
`;

function ImageThumb({ id }: { id: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    let url: string | null = null;
    (async () => {
      try {
        // Prefer the dedicated thumbnail if we ever generate one; fall back to content.
        const thumb = await window.clippy.getThumbnail(id);
        const bytes = thumb ?? (await window.clippy.getClipContent(id));
        if (!alive || !bytes || bytes.length === 0) return;
        const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes as any);
        const blob = new Blob([arr], { type: 'image/png' });
        url = URL.createObjectURL(blob);
        setSrc(url);
      } catch {}
    })();
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  if (!src) return <div className="image-thumb image-placeholder" />;
  return <img src={src} className="image-thumb" alt="" />;
}

const cardCss = `
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    background: var(--cm-surface);
    border: 1px solid var(--cm-border-subtle);
    border-radius: var(--cm-radius-card);
    color: var(--cm-text);
    transition: transform var(--cm-transition), background var(--cm-transition), border-color var(--cm-transition);
    flex-shrink: 0;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    overflow: hidden;
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
  .card.state-pressed { transform: scale(0.97); }
  .pin-stripe {
    position: absolute; top: 0; left: 14px; right: 14px; height: 2px;
    background: var(--cm-accent);
    border-bottom-left-radius: 1px; border-bottom-right-radius: 1px;
  }
  .top { display: flex; align-items: center; gap: 8px; min-height: 18px; }
  .badge {
    padding: 3px 7px; border-radius: 6px; font-size: 10px; font-weight: 600;
    letter-spacing: 0.4px; line-height: 1; text-transform: uppercase;
    flex-shrink: 0;
  }
  .source {
    flex: 1; min-width: 0;
    font-size: 10px; color: var(--cm-text-tertiary);
    font-family: 'Geist Mono', ui-monospace, monospace;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    text-align: right;
  }
  .content { flex: 1; overflow: hidden; min-height: 0; }
  .text, .code {
    font-size: 13px; line-height: 1.5; color: var(--cm-text); overflow: hidden;
    display: -webkit-box; -webkit-line-clamp: 7; -webkit-box-orient: vertical;
    white-space: pre-wrap; word-break: break-word;
  }
  .code {
    font-family: 'Geist Mono', ui-monospace, monospace; font-size: 11.5px;
    line-height: 1.45; white-space: pre; -webkit-line-clamp: 8;
  }
  .image-thumb {
    display: block;
    width: 100%; height: 100%; border-radius: 8px;
    object-fit: cover;
  }
  .image-placeholder {
    background: linear-gradient(135deg, color-mix(in srgb, var(--cm-accent) 20%, var(--cm-surface-raised)) 0%, var(--cm-surface-raised) 60%);
  }
  .color-swatch {
    flex: 1; border-radius: 8px;
    box-shadow: inset 0 0 0 1px rgba(0,0,0,.06);
  }
  .color-text {
    font-family: 'Geist Mono', ui-monospace, monospace; font-size: 11px;
    color: var(--cm-text-secondary);
  }
  .emoji { display: flex; align-items: center; justify-content: center; height: 100%; font-size: 64px; line-height: 1; }
  .bottom { display: flex; align-items: center; justify-content: space-between; min-height: 16px; }
  .time {
    font-size: 10px; color: var(--cm-text-tertiary);
    font-family: 'Geist Mono', ui-monospace, monospace; letter-spacing: 0.3px;
  }
  .star { display: inline-flex; color: var(--cm-accent); }
  .star.empty { color: var(--cm-text-tertiary); }
`;
