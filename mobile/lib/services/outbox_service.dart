import 'dart:convert';
import 'dart:typed_data';
import 'package:sqflite/sqflite.dart';
import 'db_service.dart';

class OutboxEntry {
  final int id;
  final String targetDeviceId;
  /// 'text' | 'image' | 'file' | 'resend' — resend points at clip_id.
  final String kind;
  final int? clipId;
  final Uint8List? payloadBlob;
  final Map<String, dynamic>? meta;
  final int createdAt;
  final int attempts;
  final String? lastError;

  OutboxEntry({
    required this.id,
    required this.targetDeviceId,
    required this.kind,
    this.clipId,
    this.payloadBlob,
    this.meta,
    required this.createdAt,
    required this.attempts,
    this.lastError,
  });
}

/// Per-target send queue. Items are enqueued when the chosen desktop is
/// offline or the immediate send fails, and flushed FIFO when that desktop
/// reconnects. Entries older than 24 h are purged the next time the app opens.
class OutboxService {
  static final OutboxService instance = OutboxService._();
  OutboxService._();

  static const int _ttlMs = 24 * 60 * 60 * 1000;

  Future<int> enqueueResend({
    required String targetDeviceId,
    required int clipId,
  }) async {
    final db = (await DbService.instance()).db;
    return db.insert('outbox', {
      'target_device_id': targetDeviceId,
      'kind': 'resend',
      'clip_id': clipId,
      'created_at': DateTime.now().millisecondsSinceEpoch,
    });
  }

  Future<int> enqueueText({
    required String targetDeviceId,
    required String text,
  }) async {
    final db = (await DbService.instance()).db;
    return db.insert('outbox', {
      'target_device_id': targetDeviceId,
      'kind': 'text',
      'payload_blob': Uint8List.fromList(utf8.encode(text)),
      'created_at': DateTime.now().millisecondsSinceEpoch,
    });
  }

  Future<int> enqueueBytes({
    required String targetDeviceId,
    required Uint8List bytes,
    required String mime,
    required String kind, // 'image' | 'file'
    String? name,
  }) async {
    final db = (await DbService.instance()).db;
    return db.insert('outbox', {
      'target_device_id': targetDeviceId,
      'kind': kind,
      'payload_blob': bytes,
      // ignore: use_null_aware_elements -- map literal, conditional include
      'meta_json': jsonEncode({'mime': mime, if (name != null) 'name': name}),
      'created_at': DateTime.now().millisecondsSinceEpoch,
    });
  }

  Future<List<OutboxEntry>> readForDevice(String targetDeviceId) async {
    final db = (await DbService.instance()).db;
    final rows = await db.query(
      'outbox',
      where: 'target_device_id = ?',
      whereArgs: [targetDeviceId],
      orderBy: 'created_at ASC',
    );
    return rows.map(_rowToEntry).toList();
  }

  Future<int> countForDevice(String targetDeviceId) async {
    final db = (await DbService.instance()).db;
    final r = await db.rawQuery(
      'SELECT COUNT(*) AS n FROM outbox WHERE target_device_id = ?',
      [targetDeviceId],
    );
    return Sqflite.firstIntValue(r) ?? 0;
  }

  Future<void> remove(int id) async {
    final db = (await DbService.instance()).db;
    await db.delete('outbox', where: 'id = ?', whereArgs: [id]);
  }

  Future<void> bumpAttempts(int id, String? error) async {
    final db = (await DbService.instance()).db;
    await db.rawUpdate(
      'UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?',
      [error, id],
    );
  }

  /// Drop entries older than 24 h. Called on app open.
  Future<int> purgeStale() async {
    final db = (await DbService.instance()).db;
    final cutoff = DateTime.now().millisecondsSinceEpoch - _ttlMs;
    return db.delete('outbox', where: 'created_at < ?', whereArgs: [cutoff]);
  }

  OutboxEntry _rowToEntry(Map<String, Object?> r) {
    final metaRaw = r['meta_json'] as String?;
    return OutboxEntry(
      id: r['id'] as int,
      targetDeviceId: r['target_device_id'] as String,
      kind: r['kind'] as String,
      clipId: r['clip_id'] as int?,
      payloadBlob: r['payload_blob'] as Uint8List?,
      meta: metaRaw == null ? null : jsonDecode(metaRaw) as Map<String, dynamic>,
      createdAt: r['created_at'] as int,
      attempts: r['attempts'] as int? ?? 0,
      lastError: r['last_error'] as String?,
    );
  }
}
