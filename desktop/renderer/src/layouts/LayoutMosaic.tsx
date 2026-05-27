import { useRef } from 'react';
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
  const ref = useRef<HTMLDivElement>(null);
  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (e.deltaX === 0 && e.deltaY !== 0) {
      const el = ref.current;
      if (el) { el.scrollLeft += e.deltaY; e.preventDefault(); }
    }
  }
  return (
    <div className="mosaic" ref={ref} onWheel={onWheel}>
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
          display: flex; gap: 12px; padding: 0 20px;
          overflow-x: auto; overflow-y: hidden; height: 100%; align-items: center;
        }
        .mosaic::-webkit-scrollbar { height: 6px; }
        .mosaic::-webkit-scrollbar-track { background: transparent; }
        .mosaic::-webkit-scrollbar-thumb {
          background: color-mix(in srgb, var(--cm-border-strong) 70%, transparent);
          border-radius: 3px;
        }
        .mosaic::-webkit-scrollbar-thumb:hover { background: var(--cm-text-tertiary); }
      `}</style>
    </div>
  );
}
