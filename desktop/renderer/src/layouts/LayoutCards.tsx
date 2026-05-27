import { ClipCard, type Density } from '../components/ClipCard';
import type { ClipDto } from '../../../electron/ipc-types';

export function LayoutCards({
  clips,
  selectedHash,
  density = 'comfortable',
  onSelect,
}: {
  clips: ClipDto[];
  selectedHash: string | null;
  density?: Density;
  onSelect: (hash: string) => void;
}) {
  return (
    <div className="cards-row">
      {clips.map((c) => (
        <ClipCard
          key={c.id}
          clip={c}
          density={density}
          state={c.hash === selectedHash ? 'selected' : 'default'}
          onSelect={() => onSelect(c.hash)}
        />
      ))}
      <div className="edge-fade" />
      <style>{`
        .cards-row {
          display: flex; gap: 12px; padding: 16px 20px;
          overflow-x: auto; overflow-y: hidden; height: 100%;
          align-items: stretch; scroll-snap-type: x mandatory;
        }
        .cards-row > .card { scroll-snap-align: start; }
        .edge-fade {
          position: sticky; right: 0; top: 0; bottom: 0; width: 60px;
          pointer-events: none; flex-shrink: 0;
          background: linear-gradient(to left, var(--cm-panel-scrim), transparent);
        }
      `}</style>
    </div>
  );
}
