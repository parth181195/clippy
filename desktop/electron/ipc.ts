import { ipcMain, clipboard } from 'electron';
import { execFile } from 'node:child_process';
import type { Db } from './db';
import {
  DEFAULT_SETTINGS,
  IPC,
  type ClipActionDto,
  type ClipDto,
  type ListClipsArgs,
  type Settings,
} from './ipc-types';

function actionRowToDto(r: any): ClipActionDto {
  let params: { command?: string; args?: string[] } = {};
  try { params = JSON.parse(r.params_json || '{}'); } catch {}
  return {
    id: r.id,
    contentType: r.content_type,
    label: r.label,
    kind: r.kind,
    command: params.command ?? null,
    args: params.args ?? [],
    isDefault: r.is_default === 1,
  };
}

// Convert snake_case DB row → camelCase DTO for the renderer.
function rowToDto(r: any): ClipDto {
  return {
    id: r.id,
    contentType: r.content_type,
    mime: r.mime,
    hash: r.content_hash,
    preview: r.preview,
    sourceApp: r.source_app,
    isFavorite: r.is_favorite === 1,
    isPinned: r.is_pinned === 1,
    createdAt: r.created_at,
  };
}

export function registerIpc(opts: {
  db: Db;
  onPaste: (id: number, shiftForTerminal: boolean) => Promise<void>;
  onPasteMany: (ids: number[], shiftForTerminal: boolean) => Promise<void>;
  onHidePanel: () => void;
  onShowPanel: () => void;
  onTogglePanel: () => void;
  onSettingsSaved: (next: Settings) => void;
  onPairingBegin: (deviceName: string) => Promise<{ qrSvg: string; shortCode: string }>;
  onPairingCancel: () => void;
  onUnpair: () => Promise<void>;
  onPairingState: () => { state: string; deviceName: string | null };
  onSendClipToPeer: (clipId: number) => Promise<string | null>;
  onPickColor: () => Promise<string | null>;
  onSyncTheme: (mode: string, accent: string) => void;
}): void {
  const { db, onPaste, onPasteMany, onHidePanel, onShowPanel, onTogglePanel, onSettingsSaved,
    onPairingBegin, onPairingCancel, onUnpair, onPairingState, onSendClipToPeer, onPickColor, onSyncTheme } = opts;
  const raw = db.raw();

  ipcMain.handle(IPC.listClips, (_e, args: ListClipsArgs = {}): ClipDto[] => {
    const params: any[] = [];
    let sql = `SELECT id, content_type, mime, content_hash, preview, source_app, is_favorite, is_pinned, created_at
               FROM clips WHERE 1=1`;
    if (args.search && args.search.length > 0) {
      sql += ` AND id IN (SELECT rowid FROM clips_fts WHERE clips_fts MATCH ?)`;
      params.push(`${args.search}*`);
    }
    if (args.contentTypeFilter) {
      sql += ` AND content_type = ?`;
      params.push(args.contentTypeFilter);
    }
    if (args.favoritesOnly) sql += ` AND is_favorite = 1`;
    sql += ` ORDER BY is_pinned DESC, is_favorite DESC, created_at DESC LIMIT ?`;
    params.push(args.limit ?? 500);
    return (raw.prepare(sql).all(...params) as any[]).map(rowToDto);
  });

  ipcMain.handle(IPC.getClipContent, (_e, id: number, mime?: string): Buffer => {
    if (mime) {
      const row = raw
        .prepare('SELECT content FROM clip_representations WHERE clip_id = ? AND mime = ?')
        .get(id, mime) as { content: Buffer } | undefined;
      if (row) return row.content;
    }
    const row = raw.prepare('SELECT content FROM clips WHERE id = ?').get(id) as
      | { content: Buffer }
      | undefined;
    return row?.content ?? Buffer.alloc(0);
  });

  ipcMain.handle(IPC.getThumbnail, (_e, id: number): Buffer | null => db.thumbnailFor(id));

  ipcMain.handle(IPC.toggleFavorite, (_e, id: number): boolean => {
    raw.prepare('UPDATE clips SET is_favorite = 1 - is_favorite WHERE id = ?').run(id);
    return (
      (raw.prepare('SELECT is_favorite FROM clips WHERE id = ?').get(id) as { is_favorite: number })
        .is_favorite === 1
    );
  });

  ipcMain.handle(IPC.togglePin, (_e, id: number): boolean => {
    raw.prepare('UPDATE clips SET is_pinned = 1 - is_pinned WHERE id = ?').run(id);
    return (
      (raw.prepare('SELECT is_pinned FROM clips WHERE id = ?').get(id) as { is_pinned: number })
        .is_pinned === 1
    );
  });

  ipcMain.handle(IPC.deleteClip, (_e, id: number, force: boolean): void => {
    if (!force) {
      const row = raw
        .prepare('SELECT is_pinned, is_favorite FROM clips WHERE id = ?')
        .get(id) as { is_pinned: number; is_favorite: number } | undefined;
      if (!row) return;
      if (row.is_pinned === 1 || row.is_favorite === 1) {
        throw new Error('clip is pinned or favorited; pass force=true');
      }
    }
    raw.prepare('DELETE FROM clips WHERE id = ?').run(id);
  });

  ipcMain.handle(IPC.saveEditedClip, (_e, originalId: number, newContent: string): number => {
    const row = raw
      .prepare('SELECT content_type, mime FROM clips WHERE id = ?')
      .get(originalId) as { content_type: string; mime: string } | undefined;
    if (!row) throw new Error('original clip not found');
    if (!['text', 'link', 'code', 'color', 'emoji'].includes(row.content_type)) {
      throw new Error('not editable type');
    }
    const preview = newContent.slice(0, 280);
    const inserted = db.insertClip(
      row.content_type as any,
      Buffer.from(newContent, 'utf8'),
      row.mime,
      preview,
      'Clippy (edited)',
      Date.now()
    );
    return inserted.id;
  });

  ipcMain.handle(IPC.pasteManyById, async (_e, ids: number[], shiftForTerminal: boolean): Promise<void> => {
    await onPasteMany(ids, shiftForTerminal);
  });
  ipcMain.handle(IPC.pasteById, async (_e, id: number, shiftForTerminal: boolean): Promise<void> => {
    await onPaste(id, shiftForTerminal);
  });

  ipcMain.handle(IPC.loadSettings, (): Settings => {
    const out: Settings = { ...DEFAULT_SETTINGS };
    const rows = raw.prepare('SELECT key, value FROM settings').all() as Array<{
      key: string;
      value: string;
    }>;
    for (const { key, value } of rows) applySetting(out, key, value);
    return out;
  });

  ipcMain.handle(IPC.saveSettings, (_e, s: Settings): void => {
    const upsert = raw.prepare('INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)');
    const pairs: Array<[string, string]> = [
      ['theme', s.theme],
      ['layout', s.layout],
      ['density', s.density],
      ['accent', s.accent],
      ['panel_position', s.panelPosition],
      ['hotkey_panel', s.hotkeyPanel],
      ['hotkey_paste_last', s.hotkeyPasteLast],
      ['hotkey_incognito', s.hotkeyIncognito],
      ['history_size', String(s.historySize)],
      ['polling_ms', String(s.pollingMs)],
      ['sound_on_copy', String(s.soundOnCopy)],
      ['notifications_on_copy', String(s.notificationsOnCopy)],
      ['link_previews_enabled', String(s.linkPreviewsEnabled)],
      ['auto_sync_outgoing', String(s.autoSyncOutgoing)],
      ['auto_sync_incoming', String(s.autoSyncIncoming)],
      ['incognito_auto_disable_secs', String(s.incognitoAutoDisableSecs)],
      ['autostart', String(s.autostart)],
      ['window_transparent', String(s.windowTransparent)],
    ];
    const tx = raw.transaction((rows: Array<[string, string]>) => {
      for (const [k, v] of rows) upsert.run(k, v);
    });
    tx(pairs);
    onSettingsSaved(s);
  });

  ipcMain.handle(IPC.hidePanel, () => onHidePanel());
  ipcMain.handle(IPC.showPanel, () => onShowPanel());
  ipcMain.handle(IPC.togglePanel, () => onTogglePanel());

  ipcMain.handle(IPC.pairingBegin, (_e, deviceName: string) => onPairingBegin(deviceName));
  ipcMain.handle(IPC.pairingCancel, () => onPairingCancel());
  ipcMain.handle(IPC.unpair, () => onUnpair());
  ipcMain.handle(IPC.pairingState, () => onPairingState());
  ipcMain.handle(IPC.sendClipToPeer, (_e, clipId: number) => onSendClipToPeer(clipId));

  ipcMain.handle(IPC.exclusionsList, (): string[] =>
    (raw.prepare('SELECT app_id FROM excluded_apps ORDER BY app_id').all() as Array<{ app_id: string }>)
      .map((r) => r.app_id)
  );
  ipcMain.handle(IPC.exclusionsAdd, (_e, appId: string): void => {
    const id = appId.trim().toLowerCase();
    if (!id) return;
    raw.prepare('INSERT OR IGNORE INTO excluded_apps(app_id) VALUES (?)').run(id);
  });
  ipcMain.handle(IPC.exclusionsRemove, (_e, appId: string): void => {
    raw.prepare('DELETE FROM excluded_apps WHERE app_id = ?').run(appId);
  });

  ipcMain.handle(IPC.actionsList, (_e, contentType: string): ClipActionDto[] =>
    (raw.prepare('SELECT * FROM clip_actions WHERE content_type = ? ORDER BY is_default DESC, sort_order ASC')
      .all(contentType) as any[]).map(actionRowToDto)
  );

  ipcMain.handle(IPC.actionAdd, (_e, contentType: string, label: string, command: string, args: string[]): void => {
    const next = (raw.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM clip_actions WHERE content_type = ?')
      .get(contentType) as { n: number }).n;
    raw.prepare(
      `INSERT INTO clip_actions(content_type, label, kind, params_json, is_default, sort_order)
       VALUES (?, ?, 'run_command', ?, 0, ?)`
    ).run(contentType, label.trim() || command, JSON.stringify({ command: command.trim(), args }), next);
  });

  ipcMain.handle(IPC.actionRemove, (_e, id: number): void => {
    raw.prepare('DELETE FROM clip_actions WHERE id = ?').run(id);
  });

  ipcMain.handle(IPC.pickColor, () => onPickColor());
  ipcMain.handle(IPC.copyText, (_e, text: string) => { clipboard.writeText(text); });
  ipcMain.handle(IPC.syncTheme, (_e, mode: string, accent: string) => onSyncTheme(mode, accent));

  ipcMain.handle(IPC.actionRun, async (_e, clipId: number, actionId: number): Promise<{ ok: boolean; error?: string }> => {
    const action = raw.prepare('SELECT * FROM clip_actions WHERE id = ?').get(actionId) as any;
    if (!action) return { ok: false, error: 'action not found' };
    const clip = raw.prepare('SELECT content FROM clips WHERE id = ?').get(clipId) as { content: Buffer } | undefined;
    if (!clip) return { ok: false, error: 'clip not found' };
    const content = clip.content.toString('utf8');
    const dto = actionRowToDto(action);
    return new Promise((resolve) => {
      const done = (error?: string) => resolve(error ? { ok: false, error } : { ok: true });
      try {
        if (dto.kind === 'open_url') {
          execFile('xdg-open', [content], { timeout: 5000 }, (e) => done(e ? e.message : undefined));
        } else if (dto.kind === 'run_command' && dto.command) {
          // Content passed as a single positional arg — no shell, no injection.
          execFile(dto.command, [...dto.args, content], { timeout: 5000 }, (e) => done(e ? e.message : undefined));
        } else {
          done('unsupported action');
        }
      } catch (e) {
        done((e as Error).message);
      }
    });
  });
}

function applySetting(s: Settings, key: string, value: string): void {
  switch (key) {
    case 'theme': s.theme = value; break;
    case 'layout': s.layout = value; break;
    case 'density': s.density = value; break;
    case 'accent': s.accent = value; break;
    case 'panel_position': s.panelPosition = value; break;
    case 'hotkey_panel': s.hotkeyPanel = value; break;
    case 'hotkey_paste_last': s.hotkeyPasteLast = value; break;
    case 'hotkey_incognito': s.hotkeyIncognito = value; break;
    case 'history_size': s.historySize = parseInt(value, 10) || s.historySize; break;
    case 'polling_ms': s.pollingMs = parseInt(value, 10) || s.pollingMs; break;
    case 'sound_on_copy': s.soundOnCopy = value === 'true'; break;
    case 'notifications_on_copy': s.notificationsOnCopy = value === 'true'; break;
    case 'link_previews_enabled': s.linkPreviewsEnabled = value === 'true'; break;
    case 'auto_sync_outgoing': s.autoSyncOutgoing = value === 'true'; break;
    case 'auto_sync_incoming': s.autoSyncIncoming = value === 'true'; break;
    case 'incognito_auto_disable_secs':
      s.incognitoAutoDisableSecs = parseInt(value, 10) || s.incognitoAutoDisableSecs;
      break;
    case 'autostart': s.autostart = value === 'true'; break;
    case 'window_transparent': s.windowTransparent = value === 'true'; break;
  }
}
