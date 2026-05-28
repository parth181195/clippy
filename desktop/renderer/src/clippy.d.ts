// Types for the preload-exposed `window.clippy` API.
// Mirror of electron/preload.ts. Keep in sync.

import type { ClipActionDto, ClipDto, ConnStatus, ListClipsArgs, PairingResult, Settings, TransferProgressEvent } from '../../electron/ipc-types.js';

export interface ClippyApi {
  listClips(args?: ListClipsArgs): Promise<ClipDto[]>;
  getClipContent(id: number, mime?: string): Promise<Uint8Array>;
  getThumbnail(id: number): Promise<Uint8Array | null>;
  toggleFavorite(id: number): Promise<boolean>;
  togglePin(id: number): Promise<boolean>;
  deleteClip(id: number, force?: boolean): Promise<void>;
  saveEditedClip(originalId: number, newContent: string): Promise<number>;
  pasteById(id: number, shiftForTerminal?: boolean): Promise<void>;
  loadSettings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<void>;
  hidePanel(): Promise<void>;
  showPanel(): Promise<void>;
  togglePanel(): Promise<void>;
  pairingBegin(deviceName: string): Promise<PairingResult>;
  pairingCancel(): Promise<void>;
  pairingState(): Promise<ConnStatus>;
  unpair(): Promise<void>;
  onClipNew(cb: (id: number) => void): () => void;
  onIncognitoChanged(cb: (on: boolean) => void): () => void;
  onConnState(cb: (s: ConnStatus) => void): () => void;
  onTransferProgress(cb: (p: TransferProgressEvent) => void): () => void;
  sendClipToPeer(clipId: number): Promise<string | null>;
  exclusionsList(): Promise<string[]>;
  exclusionsAdd(appId: string): Promise<void>;
  exclusionsRemove(appId: string): Promise<void>;
  actionsList(contentType: string): Promise<ClipActionDto[]>;
  actionRun(clipId: number, actionId: number): Promise<{ ok: boolean; error?: string }>;
  actionAdd(contentType: string, label: string, command: string, args: string[]): Promise<void>;
  actionRemove(id: number): Promise<void>;
}

declare global {
  interface Window {
    clippy: ClippyApi;
  }
}

export {};
