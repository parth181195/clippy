import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:sqflite/sqflite.dart';
import 'package:web_socket_channel/io.dart';
import 'package:web_socket_channel/status.dart' as ws_status;
import 'crypto_service.dart';
import 'db_service.dart';
import 'envelope.dart';

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

  final _storage = const FlutterSecureStorage();
  IOWebSocketChannel? _channel;
  Uint8List? _psk;
  PairingPayload? _paired;
  String _phoneName = 'phone';
  bool _connecting = false;
  Timer? _retryTimer;

  ConnState state = ConnState.unpaired;
  String? get desktopName => _paired?.name;

  Future<void> start() async {
    final raw = await _storage.read(key: 'pairing');
    if (raw == null) {
      state = ConnState.unpaired;
      notifyListeners();
      return;
    }
    _paired = PairingPayload.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    _psk = base64Decode(_paired!.psk);
    _phoneName = (await _storage.read(key: 'phone_name')) ?? 'phone';
    await _connect();
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
      debugPrint('[clippy] connected to ${_paired!.host}:${_paired!.port}');
      notifyListeners();
    } catch (e) {
      debugPrint('[clippy] connect failed: $e');
      try { await ch?.sink.close(); } catch (_) {}
      if (_channel == ch) _channel = null;
      state = ConnState.disconnected;
      notifyListeners();
      _scheduleRetry();
    } finally {
      _connecting = false;
    }
  }

  void _scheduleRetry() {
    _retryTimer?.cancel();
    _retryTimer = Timer(const Duration(seconds: 5), () {
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
      }
    } catch (e) {
      debugPrint('[clippy] env parse failed: $e');
    }
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
