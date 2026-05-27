import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type ClipDto, type ConnStatus, type ListClipsArgs, type PairingResult, type Settings, type TransferProgressEvent } from './ipc-types';

const api = {
  listClips: (args?: ListClipsArgs) => ipcRenderer.invoke(IPC.listClips, args ?? {}) as Promise<ClipDto[]>,
  getClipContent: (id: number, mime?: string) =>
    ipcRenderer.invoke(IPC.getClipContent, id, mime) as Promise<Uint8Array>,
  getThumbnail: (id: number) =>
    ipcRenderer.invoke(IPC.getThumbnail, id) as Promise<Uint8Array | null>,
  toggleFavorite: (id: number) => ipcRenderer.invoke(IPC.toggleFavorite, id) as Promise<boolean>,
  togglePin: (id: number) => ipcRenderer.invoke(IPC.togglePin, id) as Promise<boolean>,
  deleteClip: (id: number, force = false) => ipcRenderer.invoke(IPC.deleteClip, id, force) as Promise<void>,
  saveEditedClip: (originalId: number, newContent: string) =>
    ipcRenderer.invoke(IPC.saveEditedClip, originalId, newContent) as Promise<number>,
  pasteById: (id: number, shiftForTerminal = false) =>
    ipcRenderer.invoke(IPC.pasteById, id, shiftForTerminal) as Promise<void>,
  loadSettings: () => ipcRenderer.invoke(IPC.loadSettings) as Promise<Settings>,
  saveSettings: (s: Settings) => ipcRenderer.invoke(IPC.saveSettings, s) as Promise<void>,
  hidePanel: () => ipcRenderer.invoke(IPC.hidePanel) as Promise<void>,
  showPanel: () => ipcRenderer.invoke(IPC.showPanel) as Promise<void>,
  togglePanel: () => ipcRenderer.invoke(IPC.togglePanel) as Promise<void>,

  onClipNew: (cb: (id: number) => void) => {
    const h = (_e: any, id: number) => cb(id);
    ipcRenderer.on(IPC.EVT_CLIP_NEW, h);
    return () => ipcRenderer.off(IPC.EVT_CLIP_NEW, h);
  },
  onIncognitoChanged: (cb: (on: boolean) => void) => {
    const h = (_e: any, on: boolean) => cb(on);
    ipcRenderer.on(IPC.EVT_INCOGNITO_CHANGED, h);
    return () => ipcRenderer.off(IPC.EVT_INCOGNITO_CHANGED, h);
  },

  // Pairing + sync state
  pairingBegin: (deviceName: string) =>
    ipcRenderer.invoke(IPC.pairingBegin, deviceName) as Promise<PairingResult>,
  pairingCancel: () => ipcRenderer.invoke(IPC.pairingCancel) as Promise<void>,
  pairingState: () => ipcRenderer.invoke(IPC.pairingState) as Promise<ConnStatus>,
  unpair: () => ipcRenderer.invoke(IPC.unpair) as Promise<void>,
  sendClipToPeer: (clipId: number) =>
    ipcRenderer.invoke(IPC.sendClipToPeer, clipId) as Promise<string | null>,
  onConnState: (cb: (s: ConnStatus) => void) => {
    const h = (_e: any, s: ConnStatus) => cb(s);
    ipcRenderer.on(IPC.EVT_CONN_STATE, h);
    return () => ipcRenderer.off(IPC.EVT_CONN_STATE, h);
  },
  onTransferProgress: (cb: (p: TransferProgressEvent) => void) => {
    const h = (_e: any, p: TransferProgressEvent) => cb(p);
    ipcRenderer.on(IPC.EVT_TRANSFER_PROGRESS, h);
    return () => ipcRenderer.off(IPC.EVT_TRANSFER_PROGRESS, h);
  },
};

export type ClippyApi = typeof api;
contextBridge.exposeInMainWorld('clippy', api);
