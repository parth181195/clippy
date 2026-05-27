import { ArrowDownToLine, ArrowUpFromLine, Image as ImageIcon, FileText } from 'lucide-react';
import type { TransferProgressEvent } from '../../../electron/ipc-types';

export function TransferBanner({ transfers }: { transfers: TransferProgressEvent[] }) {
  if (transfers.length === 0) return null;
  return (
    <div className="transfers">
      {transfers.map((t) => {
        const pct = Math.min(100, Math.round((t.sent / Math.max(1, t.total)) * 100));
        return (
          <div className="tr" key={t.transferId}>
            <span className="dir">
              {t.direction === 'in' ? <ArrowDownToLine size={13} /> : <ArrowUpFromLine size={13} />}
            </span>
            <span className="kind">
              {t.kind === 'image' ? <ImageIcon size={13} /> : <FileText size={13} />}
            </span>
            <span className="name">{t.name}</span>
            <span className="pct">{t.done ? 'done' : `${pct}%`}</span>
            <div className="bar"><div className="fill" style={{ width: `${pct}%` }} /></div>
          </div>
        );
      })}
      <style>{css}</style>
    </div>
  );
}

const css = `
  .transfers {
    position: fixed; right: 16px; bottom: 44px;
    display: flex; flex-direction: column; gap: 6px;
    z-index: 9998; min-width: 280px; max-width: 380px;
  }
  .tr {
    display: grid; grid-template-columns: auto auto 1fr auto;
    align-items: center; gap: 8px;
    padding: 8px 12px;
    background: var(--cm-surface-raised);
    border: 1px solid var(--cm-border-strong);
    border-radius: 10px;
    font-size: 12px; color: var(--cm-text);
    box-shadow: 0 6px 18px rgba(0,0,0,.35);
  }
  .tr .dir, .tr .kind {
    display: inline-flex; color: var(--cm-text-secondary);
  }
  .tr .name {
    min-width: 0; overflow: hidden; text-overflow: ellipsis;
    white-space: nowrap; font-family: 'Geist Mono', ui-monospace, monospace;
    font-size: 11px;
  }
  .tr .pct {
    font-family: 'Geist Mono', ui-monospace, monospace;
    font-size: 11px; color: var(--cm-text-secondary);
  }
  .tr .bar {
    grid-column: 1 / -1;
    height: 3px; background: var(--cm-surface-sunken); border-radius: 2px;
    overflow: hidden;
  }
  .tr .fill {
    height: 100%; background: var(--cm-accent);
    transition: width 80ms linear;
  }
`;
