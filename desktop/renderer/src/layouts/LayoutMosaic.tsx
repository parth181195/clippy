import { ClipCard } from '../components/ClipCard';
import type { ClipDto } from '../../../electron/ipc-types';

function widthFor(c: ClipDto, isFirstFiltered: boolean): number {
  if (isFirstFiltered) return 320;
  switch (c.contentType) {
    case 'code': return 280;
    case 'image': return 240;
    case 'text': return 220;
    case 'link': return 200;
    case 'file': return 200;
    case 'color': return 160;
    case 'emoji': return 130;
    default: return 200;
  }
}

export function LayoutMosaic({
  clips,
  selectedHash,
  onSelect,
  filterActive = false,
}: {
  clips: ClipDto[];
  selectedHash: string | null;
  onSelect: (hash: string) => void;
  filterActive?: boolean;
}) {
  return (
    <div className="mosaic">
      {clips.map((c, i) => (
        <div key={c.id} style={{ width: widthFor(c, filterActive && i === 0), flexShrink: 0 }}>
          <ClipCard
            clip={c}
            density="comfortable"
            state={c.hash === selectedHash ? 'selected' : 'default'}
            onSelect={() => onSelect(c.hash)}
          />
        </div>
      ))}
      <style>{`
        .mosaic {
          display: flex; gap: 12px; padding: 16px 20px;
          overflow-x: auto; overflow-y: hidden; height: 100%; align-items: stretch;
        }
      `}</style>
    </div>
  );
}
