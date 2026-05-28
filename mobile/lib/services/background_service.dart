import 'dart:async';
import 'dart:convert';
import 'dart:ui';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart' show WidgetsFlutterBinding;
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:sqflite/sqflite.dart';
import 'package:web_socket_channel/io.dart';
import 'package:web_socket_channel/status.dart' as ws_status;
import 'crypto_service.dart';
import 'db_service.dart';
import 'envelope.dart';
import 'sync_service.dart' show PairingPayload;

/// Configures and starts the Android foreground service that keeps a WS
/// connection alive when the Flutter app is backgrounded or closed.
class ClippyBackground {
  static const _notifChannel = 'clippy_sync_channel';
  static const _notifId = 4711;

  static Future<void> init() async {
    // Android O+ requires a notification channel before any foreground service
    // notification can be posted. Register it before configuring the service.
    final ln = FlutterLocalNotificationsPlugin();
    const channel = AndroidNotificationChannel(
      _notifChannel,
      'Clippy sync',
      description: 'Keeps Clippy connected to your desktop.',
      importance: Importance.low,
    );
    await ln
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);

    final svc = FlutterBackgroundService();
    await svc.configure(
      androidConfiguration: AndroidConfiguration(
        onStart: _onStart,
        isForegroundMode: true,
        autoStart: true,
        autoStartOnBoot: true,
        notificationChannelId: _notifChannel,
        initialNotificationTitle: 'Clippy sync',
        initialNotificationContent: 'Connecting…',
        foregroundServiceNotificationId: _notifId,
        foregroundServiceTypes: [AndroidForegroundType.dataSync],
      ),
      iosConfiguration: IosConfiguration(autoStart: false, onForeground: _noop, onBackground: _noopBg),
    );
  }
}

@pragma('vm:entry-point')
bool _noopBg(ServiceInstance s) => true;
@pragma('vm:entry-point')
void _noop(ServiceInstance s) {}

/// Headless isolate entrypoint. Boots its own SyncLoop (the same protocol as
/// the foreground SyncService, but living in the background isolate).
@pragma('vm:entry-point')
Future<void> _onStart(ServiceInstance service) async {
  WidgetsFlutterBinding.ensureInitialized();
  DartPluginRegistrant.ensureInitialized();
  final loop = _BgSyncLoop(service);
  loop.setNotif('Clippy sync', 'Ready');

  // The foreground app owns the single-peer WS while alive. On a normal
  // launch main.dart sends 'app_foreground' immediately, which cancels this
  // grace timer so the bg stays idle. But if we started from boot with no UI,
  // nothing sends that — so after a grace period we connect ourselves.
  Timer? bootConnect = Timer(const Duration(seconds: 8), () => loop.start());
  void cancelBoot() { bootConnect?.cancel(); bootConnect = null; }

  service.on('app_foreground').listen((_) { cancelBoot(); loop.stop(); });
  service.on('app_background').listen((_) { cancelBoot(); loop.start(); });

  // Allow the foreground app to ask us to stop / reconnect.
  service.on('stop').listen((_) async {
    await loop.stop();
    service.stopSelf();
  });
  service.on('reconnect').listen((_) => loop.reconnect());
}

class _BgSyncLoop {
  final ServiceInstance service;
  final _storage = const FlutterSecureStorage();
  IOWebSocketChannel? _channel;
  Uint8List? _psk;
  PairingPayload? _paired;
  bool _connecting = false;
  Timer? _retry;

  _BgSyncLoop(this.service);

  Future<void> start() async {
    final raw = await _storage.read(key: 'pairing');
    if (raw == null) {
      setNotif('Clippy sync', 'No device paired');
      return;
    }
    _paired = PairingPayload.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    _psk = base64Decode(_paired!.psk);
    await _connect();
  }

  Future<void> stop() async {
    _retry?.cancel();
    await _channel?.sink.close(ws_status.normalClosure);
    _channel = null;
  }

  Future<void> reconnect() async {
    await _channel?.sink.close(ws_status.normalClosure);
    _channel = null;
    await _connect();
  }

  Future<void> _connect() async {
    if (_paired == null || _psk == null) return;
    if (_connecting || _channel != null) return;
    _connecting = true;
    setNotif('Clippy sync', 'Connecting to ${_paired!.name}…');
    IOWebSocketChannel? ch;
    try {
      ch = IOWebSocketChannel.connect(Uri.parse('ws://${_paired!.host}:${_paired!.port}'));
      _channel = ch;
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
          'device_id': 'clippy-phone-bg',
          'name': '${await _phoneName()} (bg)',
          'version': '0.1.0',
        },
      ));
      setNotif('Clippy sync', 'Paired with ${_paired!.name}');
    } catch (e) {
      debugPrint('[clippy-bg] connect failed: $e');
      try { await ch?.sink.close(); } catch (_) {}
      if (_channel == ch) _channel = null;
      _scheduleRetry();
    } finally {
      _connecting = false;
    }
  }

  Future<String> _phoneName() async => (await _storage.read(key: 'phone_name')) ?? 'phone';

  void _scheduleRetry() {
    _retry?.cancel();
    _retry = Timer(const Duration(seconds: 15), _connect);
    setNotif('Clippy sync', 'Offline — retrying…');
  }

  void _onDisconnect(IOWebSocketChannel which) {
    if (_channel != which) return;
    _channel = null;
    _scheduleRetry();
  }

  Future<void> _send(Envelope env) async {
    if (_channel == null || _psk == null) return;
    final pt = utf8.encode(jsonEncode(env.toJson()));
    final b64 = await CryptoService.encrypt(_psk!, Uint8List.fromList(pt));
    _channel!.sink.add(b64);
  }

  Future<void> _onMessage(dynamic raw) async {
    if (raw is! String || _psk == null) return;
    final pt = await CryptoService.decrypt(_psk!, raw);
    if (pt == null) return;
    try {
      final env = Envelope.fromJson(jsonDecode(utf8.decode(pt)) as Map<String, dynamic>);
      if (env.plugin == 'clipboard' && env.type == 'CLIP_NEW') {
        await _onClipNew(env);
      }
      // File transfer envelopes are NOT handled in background mode (would need
      // to spin up FileTransferService); they're foreground-only for v1.
    } catch (_) {}
  }

  Future<void> _onClipNew(Envelope env) async {
    final inline = env.payload['content_inline'] as String?;
    if (inline == null) return;
    final bytes = base64Decode(inline);
    final db = (await DbService.instance()).db;
    final now = DateTime.now().millisecondsSinceEpoch;
    final id = await db.insert(
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
    if (id <= 0) {
      await db.update(
        'clips',
        {'created_at': now},
        where: 'content_hash = ?',
        whereArgs: [env.payload['hash']],
      );
    }
    // Notify the UI isolate (if running) to refresh its list.
    service.invoke('clip_received');
  }

  void setNotif(String title, String body) {
    // AndroidServiceInstance is an extension on ServiceInstance — calling
    // setForegroundNotificationInfo dynamically avoids importing the android
    // package directly (which would fail with a 'main isolate only' check).
    try {
      (service as dynamic).setForegroundNotificationInfo(title: title, content: body);
    } catch (_) {}
  }
}
