import 'dart:async';
import 'dart:convert';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:sqflite/sqflite.dart';
import 'package:web_socket_channel/io.dart';
import 'package:web_socket_channel/status.dart' as ws_status;
import 'crypto_service.dart';
import 'db_service.dart';
import 'envelope.dart';
import 'file_transfer_service.dart';
import 'mdns_discovery.dart';
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

class SyncService extends ChangeNotifier {
  static final SyncService instance = SyncService._();
  SyncService._();

  final _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(
      resetOnError: true,
      encryptedSharedPreferences: true,
    ),
  );
  IOWebSocketChannel? _channel;
  Uint8List? _psk;
  PairingPayload? _paired;
  String _phoneName = 'phone';
  bool _connecting = false;
  Timer? _retryTimer;
  int _retryAttempt = 0;
  StreamSubscription? _connSub;
  final Map<String, TransferProgress> transfers = {};
  late final FileTransferService _files = FileTransferService(
    send: _send,
    onInboundComplete: notifyListeners,
    onProgress: _onProgress,
  );

  void _onProgress(TransferProgress p) {
    transfers[p.transferId] = p;
    notifyListeners();
    if (p.done) {
      Timer(const Duration(milliseconds: 1500), () {
        transfers.remove(p.transferId);
        notifyListeners();
      });
    }
  }

  ConnState state = ConnState.unpaired;
  String? get desktopName => _paired?.name;

  Future<void> start() async {
    String? raw;
    try {
      raw = await _storage.read(key: 'pairing');
    } catch (e) {
      debugPrint('[clippy] secure-storage read failed (likely stale keystore): $e');
      try { await _storage.deleteAll(); } catch (_) {}
      raw = null;
    }
    if (raw == null) {
      state = ConnState.unpaired;
      notifyListeners();
      return;
    }
    _paired = PairingPayload.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    _psk = base64Decode(_paired!.psk);
    _phoneName = (await _storage.read(key: 'phone_name')) ?? 'phone';
    // Reconnect immediately when Wi-Fi comes back (bypasses exp-backoff wait).
    _connSub?.cancel();
    _connSub = Connectivity().onConnectivityChanged.listen((results) {
      final hasNet = results.any((r) => r != ConnectivityResult.none);
      if (hasNet && state != ConnState.connected && !_connecting) {
        debugPrint('[clippy] network back → reconnect');
        _retryAttempt = 0;
        _retryTimer?.cancel();
        _connect();
      }
    });
    await _connect();
  }

  /// Release the WS without unpairing — used when the app backgrounds so the
  /// foreground-service isolate can take over the single-peer connection.
  Future<void> suspend() async {
    _retryTimer?.cancel();
    await _connSub?.cancel();
    _connSub = null;
    await _channel?.sink.close(ws_status.normalClosure);
    _channel = null;
    if (state != ConnState.unpaired) {
      state = ConnState.disconnected;
      notifyListeners();
    }
  }

  Future<void> setPaired(PairingPayload p, String phoneName) async {
    await _storage.write(key: 'pairing', value: jsonEncode(p.toJson()));
    await _storage.write(key: 'phone_name', value: phoneName);
    _paired = p;
    _psk = base64Decode(p.psk);
    _phoneName = phoneName;
    await _connect();
  }

  Future<void> unpair() async {
    await _channel?.sink.close(ws_status.normalClosure);
    _channel = null;
    await _storage.delete(key: 'pairing');
    await _storage.delete(key: 'phone_name');
    _paired = null;
    _psk = null;
    state = ConnState.unpaired;
    notifyListeners();
  }

  Future<void> _connect() async {
    if (_paired == null || _psk == null) return;
    if (_connecting || state == ConnState.connected) return;
    _connecting = true;
    state = ConnState.connecting;
    notifyListeners();
    IOWebSocketChannel? ch;
    try {
      ch = IOWebSocketChannel.connect(Uri.parse('ws://${_paired!.host}:${_paired!.port}'));
      _channel = ch;
      // Swallow the sink's done-future error (connection-refused surfaces here
      // when the desktop is down) so it doesn't become an unhandled exception.
      ch.sink.done.catchError((_) {});
      ch.stream.listen(
        _onMessage,
        onDone: () => _onDisconnect(ch!),
        onError: (_) => _onDisconnect(ch!),
        cancelOnError: true,
      );
      await _send(Envelope(
        type: 'HELLO',
        id: newUuidV4(),
        ts: DateTime.now().millisecondsSinceEpoch,
        plugin: 'core',
        payload: {
          'device_id': 'clippy-phone',
          'name': _phoneName,
          'version': '0.1.0',
        },
      ));
      state = ConnState.connected;
      _retryAttempt = 0;
      debugPrint('[clippy] connected to ${_paired!.host}:${_paired!.port}');
      notifyListeners();
    } catch (e) {
      debugPrint('[clippy] connect failed: $e');
      try { await ch?.sink.close(); } catch (_) {}
      if (_channel == ch) _channel = null;
      state = ConnState.disconnected;
      notifyListeners();
      // mDNS rescue: if the desktop's IP changed (e.g. moved Wi-Fi), the
      // saved host is wrong. Look it up by service name and persist the
      // updated host before the next retry.
      _tryMdnsRescue();
      _scheduleRetry();
    } finally {
      _connecting = false;
    }
  }

  Future<void> _tryMdnsRescue() async {
    if (_paired == null || _retryAttempt < 2) return; // only after a couple of fails
    final found = await MdnsDiscovery.findDesktop();
    if (found == null) return;
    if (found.host == _paired!.host && found.port == _paired!.port) return;
    debugPrint('[clippy] mDNS rescue: ${_paired!.host} → ${found.host}');
    final updated = PairingPayload(
      v: _paired!.v,
      deviceId: _paired!.deviceId,
      name: _paired!.name,
      host: found.host,
      port: found.port,
      psk: _paired!.psk,
      pubkey: _paired!.pubkey,
    );
    _paired = updated;
    await _storage.write(key: 'pairing', value: jsonEncode(updated.toJson()));
  }

  void _scheduleRetry() {
    _retryTimer?.cancel();
    // Exponential backoff: 2s, 4s, 8s, 16s, 32s, then cap at 60s.
    final attempt = _retryAttempt++;
    final seconds = (attempt >= 5) ? 60 : (1 << (attempt + 1));
    _retryTimer = Timer(Duration(seconds: seconds), () {
      if (state != ConnState.connected && !_connecting) _connect();
    });
  }

  void _onDisconnect(IOWebSocketChannel which) {
    // Ignore stale events from a channel we've already replaced.
    if (_channel != which) return;
    debugPrint('[clippy] disconnected');
    _channel = null;
    state = ConnState.disconnected;
    notifyListeners();
    _scheduleRetry();
  }

  Future<void> _send(Envelope env) async {
    if (_channel == null || _psk == null) return;
    final pt = utf8.encode(jsonEncode(env.toJson()));
    final b64 = await CryptoService.encrypt(_psk!, Uint8List.fromList(pt));
    _channel!.sink.add(b64);
  }

  Future<void> sendText(String text) async {
    if (_psk == null) return;
    final bytes = utf8.encode(text);
    // Quick local hash for envelope hash field (not cryptographic — just dedup tag)
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

  Future<void> _onMessage(dynamic raw) async {
    debugPrint('[clippy] frame in: ${raw.runtimeType} ${raw is String ? raw.length : "?"} bytes (psk=${_psk != null})');
    if (raw is! String || _psk == null) return;
    final pt = await CryptoService.decrypt(_psk!, raw);
    if (pt == null) { debugPrint('[clippy] decrypt FAILED'); return; }
    try {
      final env = Envelope.fromJson(jsonDecode(utf8.decode(pt)) as Map<String, dynamic>);
      debugPrint('[clippy] env in: ${env.plugin}/${env.type}');
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

  /// Called by the background isolate when it has written a new clip.
  /// Fires notifyListeners so the foreground UI re-loads from DB.
  void notifyExternalChange() => notifyListeners();

  /// Ask the desktop to resend its recent clip history (manual sync).
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

  /// Send raw bytes (image/file) to the paired desktop.
  Future<String?> sendFile({
    required Uint8List bytes,
    required String mime,
    required String kind, // 'image' | 'file'
    String? name,
  }) async {
    if (state != ConnState.connected) return null;
    return _files.sendBytes(content: bytes, mime: mime, kind: kind, name: name);
  }

  Future<void> _onClipNew(Envelope env) async {
    final inline = env.payload['content_inline'] as String?;
    if (inline == null) { debugPrint('[clippy] CLIP_NEW without content_inline; ignoring'); return; }
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
        'source_app': 'from desktop',
        'created_at': env.ts,
      },
      conflictAlgorithm: ConflictAlgorithm.ignore,
    );
    debugPrint('[clippy] clip inserted: ${env.payload['preview']}');
    notifyListeners();
  }
}
