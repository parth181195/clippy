import 'dart:async';
import 'dart:convert';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:sqflite/sqflite.dart';
import 'package:web_socket_channel/io.dart';
import 'package:web_socket_channel/status.dart' as ws_status;
import 'package:sodium_libs/sodium_libs.dart';
import 'crypto_service.dart';
import 'db_service.dart';
import 'device_identity.dart';
import 'envelope.dart';
import 'file_transfer_service.dart';
import 'mdns_discovery.dart';
import 'outbox_service.dart';
import 'theme_controller.dart';

enum ConnState { unpaired, connecting, connected, disconnected }

class PairingPayload {
  final int v;
  final String deviceId;
  final String name;
  final String host;
  final int port;
  final String psk;     // base64
  final String pubkey;  // base64

  PairingPayload({
    required this.v,
    required this.deviceId,
    required this.name,
    required this.host,
    required this.port,
    required this.psk,
    required this.pubkey,
  });

  factory PairingPayload.fromJson(Map<String, dynamic> j) => PairingPayload(
        v: j['v'] as int? ?? 1,
        deviceId: j['device_id'] as String,
        name: j['name'] as String? ?? 'desktop',
        host: j['host'] as String,
        port: (j['port'] as num).toInt(),
        psk: j['psk'] as String,
        pubkey: j['pubkey'] as String? ?? '',
      );

  Map<String, dynamic> toJson() => {
        'v': v,
        'device_id': deviceId,
        'name': name,
        'host': host,
        'port': port,
        'psk': psk,
        'pubkey': pubkey,
      };
}

/// One desktop, one WebSocket, one PSK, one retry/mDNS loop. SyncService owns
/// a list of these. Existing single-peer code paths in the UI keep working
/// because SyncService exposes aggregate state + delegates to connections.
class SyncConnection {
  PairingPayload paired;
  String phoneName;
  final void Function() onStateChange;
  final void Function(TransferProgress) onTransferProgress;
  final void Function() onExternalChange;
  final Future<void> Function(PairingPayload updated)? onPairingUpdated;

  IOWebSocketChannel? _channel;
  final Uint8List _psk;
  Timer? _retryTimer;
  int _retryAttempt = 0;
  StreamSubscription? _connSub;
  bool _connecting = false;
  ConnState state = ConnState.disconnected;

  final Map<String, TransferProgress> transfers = {};
  late final FileTransferService _files = FileTransferService(
    send: _send,
    onInboundComplete: onExternalChange,
    onProgress: _onProgress,
  );

  SyncConnection({
    required this.paired,
    required this.phoneName,
    required this.onStateChange,
    required this.onTransferProgress,
    required this.onExternalChange,
    this.onPairingUpdated,
  }) : _psk = base64Decode(paired.psk);

  String get deviceId => paired.deviceId;
  String get desktopName => paired.name;

  void _onProgress(TransferProgress p) {
    transfers[p.transferId] = p;
    onTransferProgress(p);
    if (p.done) {
      Timer(const Duration(milliseconds: 1500), () {
        transfers.remove(p.transferId);
        onStateChange();
      });
    }
  }

  Future<void> connect() async {
    if (_connecting || state == ConnState.connected) return;
    _connecting = true;
    state = ConnState.connecting;
    onStateChange();
    // Reconnect immediately on network changes (bypasses exp-backoff wait).
    _connSub ??= Connectivity().onConnectivityChanged.listen((results) {
      final hasNet = results.any((r) => r != ConnectivityResult.none);
      if (hasNet && state != ConnState.connected && !_connecting) {
        debugPrint('[clippy] (${paired.name}) network back → reconnect');
        _retryAttempt = 0;
        _retryTimer?.cancel();
        connect();
      }
    });
    IOWebSocketChannel? ch;
    try {
      ch = IOWebSocketChannel.connect(Uri.parse('ws://${paired.host}:${paired.port}'));
      _channel = ch;
      // Swallow the sink's done-future error so connection-refused doesn't
      // become an unhandled exception.
      ch.sink.done.catchError((_) {});
      ch.stream.listen(
        _onMessage,
        onDone: () => _onDisconnect(ch!),
        onError: (_) => _onDisconnect(ch!),
        cancelOnError: true,
      );
      await _send(await _buildHello());
      state = ConnState.connected;
      _retryAttempt = 0;
      debugPrint('[clippy] connected to ${paired.host}:${paired.port}');
      onStateChange();
      // Drain anything queued for this desktop while it was offline.
      _flushOutbox().catchError((e) {
        debugPrint('[clippy] outbox flush failed: $e');
      });
    } catch (e) {
      debugPrint('[clippy] (${paired.name}) connect failed: $e');
      try { await ch?.sink.close(); } catch (_) {}
      if (_channel == ch) _channel = null;
      state = ConnState.disconnected;
      onStateChange();
      _tryMdnsRescue();
      _scheduleRetry();
    } finally {
      _connecting = false;
    }
  }

  /// Release the WS without forgetting the pairing — used when the app
  /// backgrounds so the foreground-service isolate can take over.
  Future<void> suspend() async {
    _retryTimer?.cancel();
    await _connSub?.cancel();
    _connSub = null;
    await _channel?.sink.close(ws_status.normalClosure);
    _channel = null;
    state = ConnState.disconnected;
    onStateChange();
  }

  Future<void> _tryMdnsRescue() async {
    if (_retryAttempt < 2) return; // only after a couple of fails
    final found = await MdnsDiscovery.findDesktop();
    if (found == null) return;
    if (found.host == paired.host && found.port == paired.port) return;
    debugPrint('[clippy] (${paired.name}) mDNS rescue: ${paired.host} → ${found.host}');
    paired = PairingPayload(
      v: paired.v,
      deviceId: paired.deviceId,
      name: paired.name,
      host: found.host,
      port: found.port,
      psk: paired.psk,
      pubkey: paired.pubkey,
    );
    await onPairingUpdated?.call(paired);
  }

  void _scheduleRetry() {
    _retryTimer?.cancel();
    final attempt = _retryAttempt++;
    final seconds = (attempt >= 5) ? 60 : (1 << (attempt + 1));
    _retryTimer = Timer(Duration(seconds: seconds), () {
      if (state != ConnState.connected && !_connecting) connect();
    });
  }

  void _onDisconnect(IOWebSocketChannel which) {
    // Ignore stale events from a channel we've already replaced.
    if (_channel != which) return;
    debugPrint('[clippy] (${paired.name}) disconnected');
    _channel = null;
    state = ConnState.disconnected;
    onStateChange();
    _scheduleRetry();
  }

  Future<void> _send(Envelope env) async {
    if (_channel == null) return;
    // Stamp the sender on every outbound envelope so the receiver can attribute
    // clips to this phone (CLIP_NEW writes source_device_id on the desktop).
    // HELLO already sets `from` itself; leave it untouched if present.
    final stamped = env.from != null
        ? env
        : Envelope(
            type: env.type,
            id: env.id,
            ts: env.ts,
            plugin: env.plugin,
            payload: env.payload,
            from: {
              'device_id': DeviceIdentity.instance.deviceId,
              'name': phoneName,
            },
          );
    final pt = utf8.encode(jsonEncode(stamped.toJson()));
    final b64 = await CryptoService.encrypt(_psk, Uint8List.fromList(pt));
    _channel!.sink.add(b64);
  }

  Future<Envelope> _buildHello() async {
    final id = DeviceIdentity.instance;
    final sodium = await SodiumInit.init();
    final nonce = sodium.randombytes.buf(16);
    final nonceB64 = base64Encode(nonce);
    final ts = DateTime.now().millisecondsSinceEpoch;
    final signedMaterial = utf8.encode('${id.deviceId}|$ts|$nonceB64');
    final sig = await id.sign(Uint8List.fromList(signedMaterial));
    return Envelope(
      type: 'HELLO',
      id: newUuidV4(),
      ts: ts,
      plugin: 'core',
      payload: {
        'device_id': id.deviceId,
        'name': phoneName,
        'version': '0.1.0',
        'pubkey': base64Encode(id.publicKey),
        'nonce': nonceB64,
        'signature': base64Encode(sig),
      },
      from: {'device_id': id.deviceId, 'name': phoneName},
    );
  }

  Future<void> sendText(String text) async {
    final bytes = utf8.encode(text);
    final hash = bytes.fold<int>(0, (a, b) => (a * 31 + b) & 0x7fffffff).toRadixString(16);
    await _send(Envelope(
      type: 'CLIP_NEW',
      id: newUuidV4(),
      ts: DateTime.now().millisecondsSinceEpoch,
      plugin: 'clipboard',
      payload: {
        'kind': 'text',
        'mime': 'text/plain',
        'preview': text.length > 280 ? text.substring(0, 280) : text,
        'hash': hash,
        'content_inline': base64Encode(bytes),
      },
    ));
  }

  Future<void> requestSync() async {
    if (state != ConnState.connected) return;
    await _send(Envelope(
      type: 'SYNC_REQUEST',
      id: newUuidV4(),
      ts: DateTime.now().millisecondsSinceEpoch,
      plugin: 'core',
      payload: {},
    ));
  }

  Future<String?> sendFile({
    required Uint8List bytes,
    required String mime,
    required String kind,
    String? name,
  }) async {
    if (state != ConnState.connected) return null;
    return _files.sendBytes(content: bytes, mime: mime, kind: kind, name: name);
  }

  Future<void> _onMessage(dynamic raw) async {
    if (raw is! String) return;
    final pt = await CryptoService.decrypt(_psk, raw);
    if (pt == null) { debugPrint('[clippy] (${paired.name}) decrypt FAILED'); return; }
    try {
      final env = Envelope.fromJson(jsonDecode(utf8.decode(pt)) as Map<String, dynamic>);
      if (env.plugin == 'clipboard' && env.type == 'CLIP_NEW') {
        await _onClipNew(env);
      } else if (env.plugin == 'file_transfer') {
        await _files.handle(env);
      } else if (env.plugin == 'core' && env.type == 'THEME') {
        await ThemeController.instance.applyFromDesktop(
          env.payload['mode'] as String?,
          env.payload['accent'] as String?,
        );
      }
    } catch (e) {
      debugPrint('[clippy] env parse failed: $e');
    }
  }

  /// FIFO-drain anything queued for this device's outbox. Each entry is
  /// removed on send success or its attempts counter bumped on failure.
  Future<void> _flushOutbox() async {
    final entries = await OutboxService.instance.readForDevice(paired.deviceId);
    for (final e in entries) {
      if (state != ConnState.connected) break;
      try {
        switch (e.kind) {
          case 'resend':
            if (e.clipId == null) {
              await OutboxService.instance.remove(e.id);
              break;
            }
            final db = (await DbService.instance()).db;
            final rows = await db.query('clips',
                where: 'id = ?', whereArgs: [e.clipId], limit: 1);
            if (rows.isEmpty) {
              await OutboxService.instance.remove(e.id);
              break;
            }
            final row = rows.first;
            final kind = row['content_type'] as String;
            final mime = row['mime'] as String;
            final content = row['content'] as Uint8List;
            if (kind == 'text' || kind == 'link' || kind == 'code' ||
                kind == 'color' || kind == 'emoji') {
              await sendText(utf8.decode(content));
            } else {
              await sendFile(bytes: content, mime: mime, kind: kind == 'image' ? 'image' : 'file');
            }
            await OutboxService.instance.remove(e.id);
            break;
          case 'text':
            await sendText(utf8.decode(e.payloadBlob ?? Uint8List(0)));
            await OutboxService.instance.remove(e.id);
            break;
          case 'image':
          case 'file':
            final meta = e.meta ?? const {};
            await sendFile(
              bytes: e.payloadBlob ?? Uint8List(0),
              mime: meta['mime'] as String? ?? 'application/octet-stream',
              kind: e.kind,
              name: meta['name'] as String?,
            );
            await OutboxService.instance.remove(e.id);
            break;
          default:
            // Unknown kind — drop so it doesn't stay forever.
            await OutboxService.instance.remove(e.id);
        }
      } catch (err) {
        await OutboxService.instance.bumpAttempts(e.id, err.toString());
        break; // stop draining on first failure; flush again on next reconnect
      }
    }
  }

  Future<void> _onClipNew(Envelope env) async {
    final inline = env.payload['content_inline'] as String?;
    if (inline == null) return;
    final bytes = base64Decode(inline);
    final db = (await DbService.instance()).db;
    await db.insert(
      'clips',
      {
        'content_type': env.payload['kind'] ?? 'text',
        'mime': env.payload['mime'] ?? 'text/plain',
        'content': bytes,
        'content_hash': env.payload['hash'] ?? '${env.ts}',
        'preview': env.payload['preview'] ?? '',
        'source_app': 'from ${paired.name}',
        // Network provenance tags (schema v2) — light label for the UI.
        'source_device_id': paired.deviceId,
        'source_device_name': paired.name,
        'created_at': env.ts,
      },
      conflictAlgorithm: ConflictAlgorithm.ignore,
    );
    onExternalChange();
  }
}

class SyncService extends ChangeNotifier {
  static final SyncService instance = SyncService._();
  SyncService._();

  final _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(
      resetOnError: true,
      encryptedSharedPreferences: true,
    ),
  );

  String _phoneName = 'phone';
  final List<SyncConnection> _connections = [];

  /// Aggregate state for the legacy single-peer UI: connected if ANY is, else
  /// connecting if any is, else disconnected if any is, else unpaired.
  ConnState get state {
    if (_connections.isEmpty) return ConnState.unpaired;
    if (_connections.any((c) => c.state == ConnState.connected)) return ConnState.connected;
    if (_connections.any((c) => c.state == ConnState.connecting)) return ConnState.connecting;
    return ConnState.disconnected;
  }

  /// First desktop's name. The multi-pair UI (D) replaces this with a list.
  String? get desktopName =>
      _connections.isNotEmpty ? _connections.first.paired.name : null;

  /// Union of all connections' active transfers.
  Map<String, TransferProgress> get transfers {
    final m = <String, TransferProgress>{};
    for (final c in _connections) {
      m.addAll(c.transfers);
    }
    return m;
  }

  /// All currently-paired desktops.
  List<PairingPayload> get pairings =>
      _connections.map((c) => c.paired).toList(growable: false);

  /// Live SyncConnection objects so the UI can render per-device state.
  List<SyncConnection> get connections => List.unmodifiable(_connections);

  Future<List<PairingPayload>> _readPairings() async {
    try {
      final raw = await _storage.read(key: 'pairings');
      if (raw != null) {
        final list = jsonDecode(raw) as List<dynamic>;
        return list
            .map((e) => PairingPayload.fromJson(e as Map<String, dynamic>))
            .toList();
      }
    } catch (_) {}
    try {
      final legacy = await _storage.read(key: 'pairing');
      if (legacy == null) return [];
      final p = PairingPayload.fromJson(jsonDecode(legacy) as Map<String, dynamic>);
      await _storage.write(key: 'pairings', value: jsonEncode([p.toJson()]));
      return [p];
    } catch (_) {
      return [];
    }
  }

  Future<void> _writePairings(List<PairingPayload> list) async {
    await _storage.write(
      key: 'pairings',
      value: jsonEncode(list.map((e) => e.toJson()).toList()),
    );
    // Mirror the first entry to the legacy 'pairing' key so a downgrade still works.
    if (list.isNotEmpty) {
      await _storage.write(key: 'pairing', value: jsonEncode(list.first.toJson()));
    } else {
      await _storage.delete(key: 'pairing');
    }
  }

  Future<void> start() async {
    List<PairingPayload> pairings;
    try {
      pairings = await _readPairings();
    } catch (e) {
      debugPrint('[clippy] secure-storage read failed (likely stale keystore): $e');
      try { await _storage.deleteAll(); } catch (_) {}
      pairings = [];
    }
    _phoneName = (await _storage.read(key: 'phone_name')) ?? 'phone';
    if (pairings.isEmpty) {
      notifyListeners();
      return;
    }
    // Idempotent: only add connections for pairings we don't already have.
    // start() is called from main.dart AND on lifecycle.resumed; without the
    // dedup we'd end up with parallel sockets to the same desktop.
    for (final p in pairings) {
      final idx = _connections.indexWhere((c) => c.paired.deviceId == p.deviceId);
      if (idx < 0) _connections.add(_buildConnection(p));
    }
    notifyListeners();
    for (final c in _connections) {
      await c.connect();
    }
  }

  /// Release every WS without forgetting the pairings — bg handoff.
  Future<void> suspend() async {
    for (final c in _connections) {
      await c.suspend();
    }
    notifyListeners();
  }

  Future<void> setPaired(PairingPayload p, String phoneName) async {
    _phoneName = phoneName;
    await _storage.write(key: 'phone_name', value: phoneName);

    // Replace any existing connection for this device, then append + connect.
    final existing = _connections.indexWhere((c) => c.paired.deviceId == p.deviceId);
    if (existing != -1) {
      await _connections[existing].suspend();
      _connections.removeAt(existing);
    }
    final list = _connections.map((c) => c.paired).toList()..add(p);
    await _writePairings(list);
    final c = _buildConnection(p);
    _connections.add(c);
    notifyListeners();
    await c.connect();
  }

  /// Forget every pairing. (Per-device unpair lands in task D's UI.)
  Future<void> unpair() async {
    for (final c in _connections) {
      await c.suspend();
    }
    _connections.clear();
    await _storage.delete(key: 'pairings');
    await _storage.delete(key: 'pairing');
    await _storage.delete(key: 'phone_name');
    notifyListeners();
  }

  Future<void> unpairDevice(String deviceId) async {
    final i = _connections.indexWhere((c) => c.paired.deviceId == deviceId);
    if (i == -1) return;
    await _connections[i].suspend();
    _connections.removeAt(i);
    await _writePairings(_connections.map((c) => c.paired).toList());
    notifyListeners();
  }

  Future<void> sendText(String text) async {
    for (final c in _connections) {
      if (c.state == ConnState.connected) {
        await c.sendText(text);
      }
    }
  }

  Future<void> requestSync() async {
    for (final c in _connections) {
      if (c.state == ConnState.connected) {
        await c.requestSync();
      }
    }
  }

  /// Send to a specific device, or the first connected one if [targetDeviceId]
  /// is null (preserves the legacy single-peer call site).
  Future<String?> sendFile({
    required Uint8List bytes,
    required String mime,
    required String kind, // 'image' | 'file'
    String? name,
    String? targetDeviceId,
  }) async {
    SyncConnection? c;
    if (targetDeviceId != null) {
      c = _connections.firstWhere(
        (x) => x.paired.deviceId == targetDeviceId,
        orElse: () => _connections.firstWhere(
          (x) => x.state == ConnState.connected,
          orElse: () => _connections.first,
        ),
      );
    } else {
      c = _connections.cast<SyncConnection?>().firstWhere(
            (x) => x?.state == ConnState.connected,
            orElse: () => null,
          );
    }
    if (c == null || c.state != ConnState.connected) return null;
    return c.sendFile(bytes: bytes, mime: mime, kind: kind, name: name);
  }

  /// Background isolate signals "wrote a new clip" → bubble up so the UI
  /// re-loads from the DB.
  void notifyExternalChange() => notifyListeners();

  /// Re-send any existing clip to a paired desktop. If the target is offline
  /// the request is queued in the outbox and drained on reconnect. This is the
  /// "Send to…" action on history rows (PRD M11).
  Future<void> sendClipToDevice({
    required int clipId,
    required String targetDeviceId,
  }) async {
    SyncConnection? c;
    for (final x in _connections) {
      if (x.paired.deviceId == targetDeviceId) { c = x; break; }
    }
    if (c == null) return;
    if (c.state != ConnState.connected) {
      await OutboxService.instance.enqueueResend(
        targetDeviceId: targetDeviceId,
        clipId: clipId,
      );
      notifyListeners();
      return;
    }
    // Connected — send right now from the clip's DB row.
    final db = (await DbService.instance()).db;
    final rows = await db.query('clips',
        where: 'id = ?', whereArgs: [clipId], limit: 1);
    if (rows.isEmpty) return;
    final row = rows.first;
    final kind = row['content_type'] as String;
    final mime = row['mime'] as String;
    final content = row['content'] as Uint8List;
    if (kind == 'text' || kind == 'link' || kind == 'code' ||
        kind == 'color' || kind == 'emoji') {
      await c.sendText(utf8.decode(content));
    } else {
      await c.sendFile(
        bytes: content,
        mime: mime,
        kind: kind == 'image' ? 'image' : 'file',
      );
    }
  }

  SyncConnection _buildConnection(PairingPayload p) {
    return SyncConnection(
      paired: p,
      phoneName: _phoneName,
      onStateChange: notifyListeners,
      onTransferProgress: (_) => notifyListeners(),
      onExternalChange: notifyListeners,
      onPairingUpdated: (updated) async {
        // mDNS rescue updated the host:port; persist it in the list.
        final list = _connections.map((c) => c.paired).toList();
        final idx = list.indexWhere((e) => e.deviceId == updated.deviceId);
        if (idx != -1) {
          list[idx] = updated;
          await _writePairings(list);
        }
      },
    );
  }
}
