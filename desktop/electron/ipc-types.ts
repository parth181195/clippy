// Shared IPC channel + payload types between main and renderer.
// Imported by both via path alias in the renderer.

export type ContentType = 'text' | 'link' | 'code' | 'color' | 'emoji' | 'file' | 'image';

export const isTextShaped = (ct: ContentType): boolean =>
  ct === 'text' || ct === 'link' || ct === 'code' || ct === 'color' || ct === 'emoji';

export interface ClipDto {
  id: number;
  contentType: ContentType;
  mime: string;
  hash: string;
  preview: string;
  sourceApp: string | null;
  isFavorite: boolean;
  isPinned: boolean;
  createdAt: number;
}

export interface Settings {
  theme: string;
  layout: string;
  density: string;
  accent: string;
  panelPosition: string;
  hotkeyPanel: string;
  hotkeyPasteLast: string;
  hotkeyIncognito: string;
  historySize: number;
  pollingMs: number;
  soundOnCopy: boolean;
  notificationsOnCopy: boolean;
  linkPreviewsEnabled: boolean;
  autoSyncOutgoing: boolean;
  autoSyncIncoming: boolean;
  incognitoAutoDisableSecs: number;
  autostart: boolean;
  windowTransparent: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'auto',
  layout: 'cards',
  density: 'comfortable',
  accent: '#E95678',
  panelPosition: 'bottom',
  hotkeyPanel: 'Ctrl+Alt+Shift+V',
  hotkeyPasteLast: 'Ctrl+Alt+V',
  hotkeyIncognito: 'Ctrl+Shift+I',
  historySize: 500,
  pollingMs: 300,
  soundOnCopy: true,
  notificationsOnCopy: false,
  linkPreviewsEnabled: false,
  autoSyncOutgoing: true,
  autoSyncIncoming: true,
  incognitoAutoDisableSecs: 300,
  autostart: true,
  windowTransparent: true,
};

// IPC channel names — used by both sides.
export const IPC = {
  listClips: 'clip:list',
  getClipContent: 'clip:get-content',
  getThumbnail: 'clip:get-thumbnail',
  toggleFavorite: 'clip:toggle-favorite',
  togglePin: 'clip:toggle-pin',
  deleteClip: 'clip:delete',
  saveEditedClip: 'clip:save-edited',
  pasteById: 'clip:paste-by-id',
  loadSettings: 'settings:load',
  saveSettings: 'settings:save',
  hidePanel: 'panel:hide',
  showPanel: 'panel:show',
  togglePanel: 'panel:toggle',
  // Pairing / sync
  pairingBegin: 'pair:begin',
  pairingCancel: 'pair:cancel',
  pairingState: 'pair:state',
  unpair: 'pair:unpair',
  // File transfer
  sendClipToPeer: 'sync:send-clip',
  // Exclusions
  exclusionsList: 'excl:list',
  exclusionsAdd: 'excl:add',
  exclusionsRemove: 'excl:remove',
  // Events from main → renderer
  EVT_CLIP_NEW: 'evt:clip-new',
  EVT_INCOGNITO_CHANGED: 'evt:incognito-changed',
  EVT_CONN_STATE: 'evt:conn-state',
  EVT_TRANSFER_PROGRESS: 'evt:transfer-progress',
} as const;

export interface TransferProgressEvent {
  transferId: string;
  direction: 'in' | 'out';
  name: string;
  kind: 'image' | 'file';
  sent: number;
  total: number;
  done: boolean;
  failed?: string;
}

export type ConnState = 'unpaired' | 'connecting' | 'connected' | 'disconnected';

export interface ConnStatus {
  state: ConnState;
  deviceName: string | null;
}

export interface PairingResult {
  qrSvg: string;
  shortCode: string;
}

export interface ListClipsArgs {
  search?: string | null;
  contentTypeFilter?: string | null;
  favoritesOnly?: boolean;
  limit?: number;
}
