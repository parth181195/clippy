import type { ClipDto } from '../../../electron/ipc-types';
import { relTime } from '../components/ClipCard';

type Group = { label: string; items: ClipDto[] };

function buildGroups(cs: ClipDto[], searchActive: boolean): Group[] {
  if (searchActive) return [{ label: `RESULTS · ${cs.length} MATCHES`, items: cs }];
  const pinned = cs.filter((c) => c.isPinned);
  const others = cs.filter((c) => !c.isPinned);
  const now = Date.now();
  const today = others.filter((c) => now - c.createdAt < 86_400_000);
  const earlier = others.filter((c) => now - c.createdAt >= 86_400_000);
  const g: Group[] = [];
  if (pinned.length) g.push({ label: 'PINNED', items: pinned });
  if (today.length) g.push({ label: 'TODAY', items: today });
  if (earlier.length) g.push({ label: 'EARLIER', items: earlier });
  return g;
}

function previewText(c: ClipDto): string {
  if (c.contentType === 'image') return 'Screenshot';
  if (c.contentType === 'file') return c.preview;
  return c.preview.split('\n')[0];
}

export function LayoutSectioned({
  clips,
  selectedHash,
  onSelect,
  searchActive = false,
}: {
  clips: ClipDto[];
  selectedHash: string | null;
  onSelect: (hash: string) => void;
  searchActive?: boolean;
}) {
  const groups = buildGroups(clips, searchActive);
  return (
    <div className="sectioned">
      {groups.map((g, gi) => (
        <div className="group" key={gi}>
          <div className={`label ${g.label.startsWith('RESULTS') ? 'results' : ''}`}>{g.label}</div>
          {g.items.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`row ${c.hash === selectedHash ? 'selected' : ''}`}
              onClick={() => onSelect(c.hash)}
            >
              <span
                className="badge"
                style={{
                  background: `var(--badge-${c.contentType}-bg)`,
                  color: `var(--badge-${c.contentType}-fg)`,
                }}
              >
                {c.contentType.toUpperCase()}
              </span>
              <span className="text">{previewText(c)}</span>
              {c.isFavorite && <span className="star">★</span>}
              <span className="time">{relTime(c.createdAt)}</span>
            </button>
          ))}
        </div>
      ))}
      {groups.length === 0 && <div className="empty">— nothing —</div>}
      <style>{sectionedCss}</style>
    </div>
  );
}

const sectionedCss = `
  .sectioned {
    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px;
    padding: 14px 16px; height: 100%; overflow: hidden;
  }
  .group { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .label {
    font-size: 10px; font-weight: 600; color: var(--cm-text-tertiary);
    letter-spacing: 0.8px; padding: 0 10px 5px;
    font-family: 'Geist Mono', ui-monospace, monospace;
  }
  .label.results { color: var(--cm-accent); }
  .row {
    display: flex; align-items: center; gap: 10px; padding: 6px 10px;
    border-radius: 7px; background: transparent; border: 1px solid transparent;
    cursor: pointer; font-family: inherit; text-align: left; color: var(--cm-text);
  }
  .row.selected { background: var(--cm-surface-raised); border-color: var(--cm-accent); }
  .row .badge { padding: 3px 7px; border-radius: 6px; font-size: 10px; font-weight: 600; }
  .row .text {
    flex: 1; min-width: 0; font-size: 13px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .row .star { color: var(--cm-accent); }
  .row .time {
    font-size: 10px; color: var(--cm-text-tertiary);
    font-family: 'Geist Mono', ui-monospace, monospace;
    width: 28px; text-align: right;
  }
  .sectioned .empty {
    display: flex; align-items: center; justify-content: center;
    grid-column: 1 / -1; color: var(--cm-text-tertiary);
  }
`;
