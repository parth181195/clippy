import 'dart:async';
import 'dart:convert';
import 'package:crypto/crypto.dart' show sha256;
import 'package:flutter/foundation.dart';
import 'package:sqflite/sqflite.dart';
import 'db_service.dart';
import 'envelope.dart';

typedef SendFn = Future<void> Function(Envelope env);

const int _chunkSize = 32 * 1024;
const int _maxFileSize = 10 * 1024 * 1024;

class _Inbound {
  final String transferId;
  final String name;
  final String mime;
  final int size;
  final String hash;
  final String kind;
  final int chunkCount;
  final List<Uint8List?> chunks;
  bool cancelled = false;

  _Inbound({
    required this.transferId,
    required this.name,
    required this.mime,
    required this.size,
    required this.hash,
    required this.kind,
    required this.chunkCount,
  }) : chunks = List<Uint8List?>.filled(chunkCount, null);
}

class _Outbound {
  final String transferId;
  final Uint8List content;
  final String name;
  final String kind;
  bool cancelled = false;
  _Outbound({required this.transferId, required this.content, required this.name, required this.kind});
}

class TransferProgress {
  final String transferId;
  final String direction; // 'in' | 'out'
  final String name;
  final String kind;
  final int sent;
  final int total;
  final bool done;
  TransferProgress({
    required this.transferId, required this.direction, required this.name,
    required this.kind, required this.sent, required this.total, required this.done,
  });
}

class FileTransferService {
  final SendFn send;
  final VoidCallback onInboundComplete;
  final void Function(TransferProgress p)? onProgress;
  final Map<String, _Inbound> _inbound = {};
  final Map<String, _Outbound> _outbound = {};

  FileTransferService({required this.send, required this.onInboundComplete, this.onProgress});

  /// Send raw bytes as a file/image to the peer. Returns transfer_id.
  Future<String> sendBytes({
    required Uint8List content,
    required String mime,
    required String kind, // 'image' | 'file'
    String? name,
  }) async {
    if (content.length > _maxFileSize) {
      throw StateError('file too large (${content.length}B > ${_maxFileSize}B v1 cap)');
    }
    final hash = sha256.convert(content).toString();
    final chunkCount = (content.length / _chunkSize).ceil();
    final transferId = '${DateTime.now().millisecondsSinceEpoch.toRadixString(16)}-${hash.substring(0, 12)}';
    final finalName = name ?? 'clip-$transferId.${_extFor(mime)}';
    _outbound[transferId] = _Outbound(transferId: transferId, content: content, name: finalName, kind: kind);
    await send(Envelope(
      type: 'FILE_OFFER',
      id: newUuidV4(),
      ts: DateTime.now().millisecondsSinceEpoch,
      plugin: 'file_transfer',
      payload: {
        'transfer_id': transferId,
        'name': finalName,
        'mime': mime,
        'kind': kind,
        'size': content.length,
        'hash': hash,
        'chunk_count': chunkCount,
        'chunk_size': _chunkSize,
      },
    ));
    onProgress?.call(TransferProgress(
      transferId: transferId, direction: 'out', name: finalName, kind: kind,
      sent: 0, total: content.length, done: false,
    ));
    return transferId;
  }

  Future<void> handle(Envelope env) async {
    switch (env.type) {
      case 'FILE_OFFER': await _onOffer(env); break;
      case 'FILE_ACCEPT': await _onAccept(env); break;
      case 'FILE_CHUNK': _onChunk(env); break;
      case 'FILE_DONE': await _onDone(env); break;
      case 'FILE_CANCEL': _onCancel(env); break;
    }
  }

  Future<void> _onOffer(Envelope env) async {
    final p = env.payload;
    final transferId = p['transfer_id'] as String;
    final size = (p['size'] as num).toInt();
    if (size > _maxFileSize) {
      await send(Envelope(
        type: 'FILE_CANCEL', id: newUuidV4(),
        ts: DateTime.now().millisecondsSinceEpoch, plugin: 'file_transfer',
        payload: {'transfer_id': transferId, 'reason': 'too_large'},
      ));
      return;
    }
    _inbound[transferId] = _Inbound(
      transferId: transferId,
      name: p['name'] as String,
      mime: p['mime'] as String,
      size: size,
      hash: p['hash'] as String,
      kind: (p['kind'] as String?) ?? 'file',
      chunkCount: (p['chunk_count'] as num).toInt(),
    );
    await send(Envelope(
      type: 'FILE_ACCEPT', id: newUuidV4(),
      ts: DateTime.now().millisecondsSinceEpoch, plugin: 'file_transfer',
      payload: {'transfer_id': transferId, 'start_chunk': 0},
    ));
  }

  Future<void> _onAccept(Envelope env) async {
    final transferId = env.payload['transfer_id'] as String;
    final startChunk = (env.payload['start_chunk'] as num?)?.toInt() ?? 0;
    final out = _outbound[transferId];
    if (out == null) return;
    final total = out.content.length;
    final chunkCount = (total / _chunkSize).ceil();
    for (var i = startChunk; i < chunkCount; i++) {
      if (out.cancelled) return;
      final start = i * _chunkSize;
      final end = (start + _chunkSize) > total ? total : start + _chunkSize;
      final slice = out.content.sublist(start, end);
      await send(Envelope(
        type: 'FILE_CHUNK', id: newUuidV4(),
        ts: DateTime.now().millisecondsSinceEpoch, plugin: 'file_transfer',
        payload: {
          'transfer_id': transferId,
          'chunk_index': i,
          'data': base64Encode(slice),
        },
      ));
      onProgress?.call(TransferProgress(
        transferId: transferId, direction: 'out', name: out.name, kind: out.kind,
        sent: end, total: total, done: false,
      ));
    }
    await send(Envelope(
      type: 'FILE_DONE', id: newUuidV4(),
      ts: DateTime.now().millisecondsSinceEpoch, plugin: 'file_transfer',
      payload: {'transfer_id': transferId, 'ok': true},
    ));
    onProgress?.call(TransferProgress(
      transferId: transferId, direction: 'out', name: out.name, kind: out.kind,
      sent: total, total: total, done: true,
    ));
    _outbound.remove(transferId);
  }

  void _onChunk(Envelope env) {
    final transferId = env.payload['transfer_id'] as String;
    final t = _inbound[transferId];
    if (t == null || t.cancelled) return;
    final idx = (env.payload['chunk_index'] as num).toInt();
    final bytes = base64Decode(env.payload['data'] as String);
    t.chunks[idx] = bytes;
    final received = t.chunks.fold<int>(0, (a, b) => a + (b?.length ?? 0));
    onProgress?.call(TransferProgress(
      transferId: transferId, direction: 'in', name: t.name, kind: t.kind,
      sent: received, total: t.size, done: false,
    ));
  }

  Future<void> _onDone(Envelope env) async {
    final transferId = env.payload['transfer_id'] as String;
    final t = _inbound.remove(transferId);
    if (t == null || t.cancelled) return;
    final full = Uint8List(t.size);
    var off = 0;
    for (final c in t.chunks) {
      if (c == null) return;
      full.setRange(off, off + c.length, c);
      off += c.length;
    }
    if (off != t.size) return;
    final actualHash = sha256.convert(full).toString();
    if (actualHash != t.hash) {
      debugPrint('[clippy] file hash mismatch — dropping ${t.name}');
      return;
    }
    final db = (await DbService.instance()).db;
    final now = DateTime.now().millisecondsSinceEpoch;
    final newId = await db.insert(
      'clips',
      {
        'content_type': t.kind,
        'mime': t.mime,
        'content': full,
        'content_hash': t.hash,
        'preview': t.name,
        'source_app': 'from desktop',
        'created_at': now,
      },
      conflictAlgorithm: ConflictAlgorithm.ignore,
    );
    if (newId <= 0) {
      // Duplicate content_hash — bump created_at so it sorts back to top.
      await db.update(
        'clips',
        {'created_at': now},
        where: 'content_hash = ?',
        whereArgs: [t.hash],
      );
      debugPrint('[clippy] file dedup (existing hash) — bumped: ${t.name} (${t.size}B)');
    } else {
      debugPrint('[clippy] file received: ${t.name} (${t.size}B) → clip #$newId');
    }
    onProgress?.call(TransferProgress(
      transferId: transferId, direction: 'in', name: t.name, kind: t.kind,
      sent: t.size, total: t.size, done: true,
    ));
    onInboundComplete();
  }

  void _onCancel(Envelope env) {
    final transferId = env.payload['transfer_id'] as String;
    _inbound.remove(transferId);
    _outbound.remove(transferId);
  }
}

String _extFor(String mime) {
  switch (mime) {
    case 'image/png': return 'png';
    case 'image/jpeg': return 'jpg';
    case 'image/gif': return 'gif';
    case 'image/webp': return 'webp';
    case 'application/pdf': return 'pdf';
    default: return 'bin';
  }
}
