import { useEffect, useState } from 'react';
import { Star, Send, Pin, Trash2, Pencil, ExternalLink, Terminal } from 'lucide-react';
import * as Menu from '@radix-ui/react-context-menu';
import type { ClipActionDto, ClipDto } from '../../../electron/ipc-types';
import { SourceIcon } from './SourceIcon';

const BASH_KW = /\b(sudo|cd|ls|cat|grep|curl|echo|export|apt|install|docker|compose|up|down|run|build|exec)\b/;
const TS_KW = /\b(const|let|var|function|return|if|else|import|export|from|async|await|new|class|extends|interface|type|null|undefined|true|false)\b/;

function highlight(code: string): React.ReactNode {
  const isBash = /^[#$]|^\s*(sudo|apt|cd|ls|docker|curl)\s/.test(code);
  const kwRe = isBash ? BASH_KW : TS_KW;
  const out: { t: string; v: string }[] = [];
  let i = 0;
  while (i < code.length) {
    const slice = code.slice(i);
    let m: RegExpMatchArray | null;
    if ((m = slice.match(/^(\/\/[^\n]*|#[^\n]*)/))) { out.push({ t: 'c', v: m[0] }); i += m[0].length; continue; }
    if ((m = slice.match(/^(['"`])(?:\\.|(?!\1).)*\1/))) { out.push({ t: 's', v: m[0] }); i += m[0].length; continue; }
    const kw = slice.match(new RegExp('^' + kwRe.source));
    if (kw) { out.push({ t: 'k', v: kw[0] }); i += kw[0].length; continue; }
    if ((m = slice.match(/^\d+(\.\d+)?/))) { out.push({ t: 'n', v: m[0] }); i += m[0].length; continue; }
    if ((m = slice.match(/^[a-zA-Z_$][\w$]*/))) { out.push({ t: 'i', v: m[0] }); i += m[0].length; continue; }
    out.push({ t: 'p', v: code[i] });
    i++;
  }
  return out.map((tok, idx) => <span key={idx} className={`hl-${tok.t}`}>{tok.v}</span>);
}

function hexToRgb(hex: string): string | null {
  const m = hex.trim().match(/^#?([\da-f]{6})$/i) || hex.trim().match(/^#?([\da-f]{3})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return `rgb(${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff})`;
}

function fileExt(name: string, mime: string): string {
  const m = name.match(/\.([a-z0-9]{1,6})$/i);
  if (m) return m[1].toUpperCase();
  if (mime.includes('pdf')) return 'PDF';
  if (mime.includes('gzip') || mime.includes('zip')) return 'ZIP';
  if (mime.includes('image/')) return mime.split('/')[1].toUpperCase();
  return 'BIN';
}

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

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

export interface SyncTarget {
  deviceId: string;
  name: string;
  isConnected: boolean;
}

export interface ClipCardActions {
  onSend?: () => void;
  onSendToDevice?: (deviceId: string) => void;
  /** Paired-desktop list. When > 1, the context menu shows a "Send to…" submenu. */
  sendTargets?: SyncTarget[];
  onToggleFavorite?: () => void;
  onTogglePin?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onRunAction?: (actionId: number) => void;
}

export function ClipCard({
  clip,
  state = 'default',
  density = 'comfortable',
  onSelect = () => {},
  actions,
  canSend = false,
  multiSelected = false,
}: {
  clip: ClipDto;
  state?: CardState;
  density?: Density;
  onSelect?: (mod: { ctrlKey: boolean; metaKey: boolean }) => void;
  actions?: ClipCardActions;
  canSend?: boolean;
  multiSelected?: boolean;
}) {
  const sendTargets = actions?.sendTargets;
  const s = SIZES[density];
  const ct = clip.contentType;
  const [clipActions, setClipActions] = useState<ClipActionDto[]>([]);

  let content: React.ReactNode;
  if (ct === 'image') content = <ImageThumb id={clip.id} />;
  else if (ct === 'color') {
    const rgb = hexToRgb(clip.preview);
    content = (
      <div className="color-body">
        <div className="color-swatch" style={{ background: clip.preview }}>
          <div className="color-gloss" />
        </div>
        <div className="color-meta">
          <div className="color-hex">{clip.preview.trim().toUpperCase()}</div>
          {rgb && <div className="color-rgb">{rgb}</div>}
        </div>
      </div>
    );
  } else if (ct === 'emoji') {
    content = <div className="emoji">{clip.preview}</div>;
  } else if (ct === 'code') {
    content = <pre className="code">{highlight(clip.preview)}</pre>;
  } else if (ct === 'link') {
    const url = clip.preview.trim();
    const host = url.replace(/^https?:\/\/(www\.)?/, '').split(/[/?#]/)[0] || '?';
    const initial = (host[0] ?? '?').toUpperCase();
    content = (
      <div className="link-body">
        <div className="link-row">
          <span className="favicon" style={{ background: `hsl(${hashHue(host)}, 60%, 50%)` }}>{initial}</span>
          <span className="link-url">{host}</span>
        </div>
        <div className="link-title">{url}</div>
      </div>
    );
  } else if (ct === 'file') {
    const ext = fileExt(clip.preview, clip.mime);
    content = (
      <div className="file-body">
        <div className="file-glyph">
          <svg width="44" height="52" viewBox="0 0 44 52" fill="none">
            <path d="M4 4a4 4 0 0 1 4-4h22l10 10v38a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill="var(--cm-surface)" stroke="var(--cm-border-strong)" strokeWidth="1" />
            <path d="M30 0l10 10h-7a3 3 0 0 1-3-3z" fill="var(--cm-surface-raised)" stroke="var(--cm-border-strong)" strokeWidth="1" />
            <rect x="10" y="22" width="18" height="1.5" rx="0.75" fill="var(--cm-border-strong)" />
            <rect x="10" y="26" width="22" height="1.5" rx="0.75" fill="var(--cm-border-strong)" />
            <rect x="10" y="30" width="14" height="1.5" rx="0.75" fill="var(--cm-border-strong)" />
          </svg>
          <span className="file-ext">{ext}</span>
        </div>
        <div className="file-name">{clip.preview}</div>
      </div>
    );
  } else {
    content = <div className="text">{clip.preview}</div>;
  }

  const cardBtn = (
    <button
      type="button"
      className={`card state-${state} type-${ct}${multiSelected ? ' multi' : ''}`}
      style={{
        width: s.w,
        height: s.h,
        padding: s.pad,
        gap: s.gap,
      }}
      onClick={(e) => onSelect({ ctrlKey: e.ctrlKey, metaKey: e.metaKey })}
    >
      {multiSelected && <span className="multi-check">✓</span>}
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
        <SourceIcon sourceApp={clip.sourceApp} />
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

  const onMenuOpen = (open: boolean) => {
    if (open && actions.onRunAction) {
      window.clippy.actionsList(ct).then(setClipActions).catch(() => setClipActions([]));
    }
  };

  return (
    <Menu.Root onOpenChange={onMenuOpen}>
      <Menu.Trigger asChild>{cardBtn}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Content className="cm-ctx" collisionPadding={8}>
          {actions.onRunAction && clipActions.length > 0 && (
            <>
              {clipActions.map((a) => (
                <Menu.Item
                  key={a.id}
                  className="cm-ctx-item"
                  onSelect={() => actions.onRunAction!(a.id)}
                >
                  {a.kind === 'open_url' ? <ExternalLink size={13} strokeWidth={2} /> : <Terminal size={13} strokeWidth={2} />}
                  <span>{a.label}</span>
                </Menu.Item>
              ))}
              <Menu.Separator className="cm-ctx-sep" />
            </>
          )}
          {actions.onSend && (!sendTargets || sendTargets.length <= 1) && (
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
          {actions.onSendToDevice && sendTargets && sendTargets.length > 1 && (
            <Menu.Sub>
              <Menu.SubTrigger className="cm-ctx-item">
                <Send size={13} strokeWidth={2} />
                <span>Send to…</span>
              </Menu.SubTrigger>
              <Menu.Portal>
                <Menu.SubContent className="cm-ctx" sideOffset={4}>
                  {sendTargets.map((t) => (
                    <Menu.Item
                      key={t.deviceId}
                      className="cm-ctx-item"
                      onSelect={() => actions.onSendToDevice!(t.deviceId)}
                    >
                      <span style={{
                        width: 6, height: 6, borderRadius: 3, marginRight: 2,
                        background: t.isConnected ? '#7CE8B5' : 'var(--cm-text-tertiary)',
                      }} />
                      <span>{t.name}</span>
                      {!t.isConnected && <span className="cm-ctx-kbd">queue</span>}
                    </Menu.Item>
                  ))}
                </Menu.SubContent>
              </Menu.Portal>
            </Menu.Sub>
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
  .card.multi {
    border-color: var(--cm-accent);
    box-shadow: inset 0 0 0 1px var(--cm-accent);
  }
  .multi-check {
    position: absolute; top: 8px; right: 8px; z-index: 2;
    width: 18px; height: 18px; border-radius: 50%;
    background: var(--cm-accent); color: white;
    font-size: 11px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
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
  .src-icon { display: inline-flex; flex-shrink: 0; }
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
  .color-body { display: flex; flex-direction: column; gap: 10px; height: 100%; }
  .color-swatch {
    flex: 1; border-radius: 8px; position: relative; overflow: hidden;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.08);
  }
  .color-gloss {
    position: absolute; top: 0; left: 0; right: 0; height: 40%;
    background: linear-gradient(180deg, rgba(255,255,255,.10) 0%, rgba(255,255,255,0) 100%);
  }
  .color-hex { color: var(--cm-text); font-weight: 500; font-size: 12px; letter-spacing: 0.4px; font-family: 'Geist Mono', ui-monospace, monospace; }
  .color-rgb { color: var(--cm-text-secondary); font-size: 10px; font-family: 'Geist Mono', ui-monospace, monospace; margin-top: 2px; }
  .link-body { display: flex; flex-direction: column; gap: 10px; }
  .link-row { display: flex; align-items: center; gap: 7px; }
  .favicon {
    width: 16px; height: 16px; border-radius: 4px;
    display: inline-flex; align-items: center; justify-content: center;
    color: white; font-size: 9px; font-weight: 700; flex-shrink: 0;
    box-shadow: inset 0 -1px 0 rgba(0,0,0,.15), 0 1px 2px rgba(0,0,0,.15);
  }
  .link-url {
    font-size: 11px; color: var(--cm-text-secondary);
    font-family: 'Geist Mono', ui-monospace, monospace;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
  }
  .link-title {
    font-size: 13px; color: var(--cm-text); font-weight: 500; line-height: 1.4;
    overflow: hidden; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical;
    letter-spacing: -0.1px; word-break: break-word;
  }
  .file-body { display: flex; flex-direction: column; gap: 10px; height: 100%; }
  .file-glyph {
    position: relative; flex: 1; display: flex; align-items: center; justify-content: center;
    background: var(--cm-surface-sunken); border-radius: 8px;
    border: 1px dashed var(--cm-border-subtle);
  }
  .file-ext {
    position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%);
    padding: 2px 6px; border-radius: 3px;
    background: var(--cm-text-tertiary); color: white;
    font-size: 8px; font-weight: 700; letter-spacing: 0.6px; line-height: 1;
    font-family: 'Geist Mono', ui-monospace, monospace;
  }
  .file-name {
    font-size: 12px; color: var(--cm-text); font-weight: 500;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .hl-k { color: #C792EA; }
  .hl-s { color: #7CE8B5; }
  .hl-c { color: var(--cm-text-tertiary); font-style: italic; }
  .hl-n { color: #FFCB6B; }
  .hl-i { color: var(--cm-text); }
  .hl-p { color: var(--cm-text-secondary); }
  .emoji { display: flex; align-items: center; justify-content: center; height: 100%; font-size: 64px; line-height: 1; }
  .bottom { display: flex; align-items: center; justify-content: space-between; min-height: 16px; }
  .time {
    font-size: 10px; color: var(--cm-text-tertiary);
    font-family: 'Geist Mono', ui-monospace, monospace; letter-spacing: 0.3px;
  }
  .star { display: inline-flex; color: var(--cm-accent); }
  .star.empty { color: var(--cm-text-tertiary); }
`;
