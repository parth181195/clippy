import { useRef } from 'react';
import { ClipCard, type ClipCardActions, type Density } from '../components/ClipCard';
import type { ClipDto } from '../../../electron/ipc-types';

export function LayoutCards({
  clips,
  selectedHash,
  density = 'comfortable',
  onSelect,
  buildActions,
  canSend,
}: {
  clips: ClipDto[];
  selectedHash: string | null;
  density?: Density;
  onSelect: (hash: string) => void;
  buildActions?: (clip: ClipDto) => ClipCardActions;
  canSend?: (clip: ClipDto) => boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    // Map vertical wheel to horizontal scroll. Multiplier makes each tick feel
    // like ~1.5 cards. No CSS smooth-behavior because it queues multiple
    // animations on rapid wheel and feels laggy.
    if (e.deltaX === 0 && e.deltaY !== 0) {
      const el = ref.current;
      if (el) {
        el.scrollLeft += e.deltaY * 2;
        e.preventDefault();
      }
    }
  }
  return (
    <div className="cards-row" ref={ref} onWheel={onWheel}>
      {clips.map((c) => (
        <ClipCard
          key={c.id}
          clip={c}
          density={density}
          state={c.hash === selectedHash ? 'selected' : 'default'}
          onSelect={() => onSelect(c.hash)}
          actions={buildActions?.(c)}
          canSend={canSend?.(c) ?? false}
        />
      ))}
      <style>{`
        .cards-row {
          display: flex; gap: 12px; padding: 0 20px;
          overflow-x: auto; overflow-y: hidden; height: 100%;
          align-items: center;
        }
        .cards-row::-webkit-scrollbar { height: 6px; }
        .cards-row::-webkit-scrollbar-track { background: transparent; }
        .cards-row::-webkit-scrollbar-thumb {
          background: color-mix(in srgb, var(--cm-border-strong) 70%, transparent);
          border-radius: 3px;
        }
        .cards-row::-webkit-scrollbar-thumb:hover { background: var(--cm-text-tertiary); }
      `}</style>
    </div>
  );
}
