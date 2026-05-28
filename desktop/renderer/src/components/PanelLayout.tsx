import type { ReactNode } from 'react';
import { LayoutCards } from '../layouts/LayoutCards';
import { LayoutSpotlight } from '../layouts/LayoutSpotlight';
import { LayoutSectioned } from '../layouts/LayoutSectioned';
import { LayoutMosaic } from '../layouts/LayoutMosaic';
import { EmptyState } from './EmptyState';
import type { ClipDto } from '../../../electron/ipc-types';
import type { ClipCardActions, Density } from './ClipCard';

export function PanelLayout({
  layout,
  clips,
  selectedHash,
  density,
  filter,
  onSelect,
  focusOverride = null,
  buildActions,
  canSend,
  multiSelected,
}: {
  layout: 'cards' | 'spotlight' | 'sectioned' | 'mosaic';
  clips: ClipDto[];
  selectedHash: string | null;
  density: Density;
  filter: { search: string; type: string | null; favoritesOnly: boolean };
  onSelect: (hash: string, mod?: { ctrlKey: boolean; metaKey: boolean }) => void;
  focusOverride?: ReactNode | null;
  buildActions?: (clip: ClipDto) => ClipCardActions;
  canSend?: (clip: ClipDto) => boolean;
  multiSelected?: Set<string>;
}) {
  if (clips.length === 0) {
    if (filter.search) return <EmptyState variant="no-results" search={filter.search} />;
    if (filter.type) return <EmptyState variant="no-filter" />;
    return <EmptyState variant="no-history" />;
  }
  switch (layout) {
    case 'cards':     return <LayoutCards   clips={clips} selectedHash={selectedHash} density={density} onSelect={onSelect} buildActions={buildActions} canSend={canSend} multiSelected={multiSelected} />;
    case 'spotlight': return <LayoutSpotlight clips={clips} selectedHash={selectedHash} onSelect={onSelect} focusOverride={focusOverride} />;
    case 'sectioned': return <LayoutSectioned clips={clips} selectedHash={selectedHash} onSelect={onSelect} searchActive={!!filter.search} />;
    case 'mosaic':    return <LayoutMosaic    clips={clips} selectedHash={selectedHash} onSelect={onSelect} filterActive={!!filter.type} />;
  }
}
