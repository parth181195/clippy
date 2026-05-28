import 'package:flutter/material.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'app.dart';
import 'services/background_service.dart';
import 'services/db_service.dart';
import 'services/error_reporting.dart';
import 'services/share_receiver.dart';
import 'services/sync_service.dart';
import 'services/theme_controller.dart';

// Sentry DSN is a write-only ingest key — safe to embed. Override with
// --dart-define=SENTRY_DSN=... at build time if needed.
const _kSentryDsn =
    'https://9502f9eba61adfd44d1c49b651298abd@o4511466706567168.ingest.de.sentry.io/4511466716659792';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ErrorReporting.instance.load();
  await SentryFlutter.init(
    (options) {
      options.dsn = const String.fromEnvironment('SENTRY_DSN', defaultValue: _kSentryDsn);
      // Honor the opt-out: drop every event when reporting is disabled.
      options.beforeSend = (event, hint) => ErrorReporting.instance.enabled ? event : null;
    },
    appRunner: _bootstrap,
  );
}

Future<void> _bootstrap() async {
  await DbService.instance();
  await ThemeController.instance.load();
  // Android 13+ requires runtime POST_NOTIFICATIONS permission for any
  // notification to appear, including the foreground service's persistent one.
  try {
    final status = await Permission.notification.status;
    if (!status.isGranted) await Permission.notification.request();
  } catch (_) {}
  await ClippyBackground.init();
  final bg = FlutterBackgroundService();
  // We're the foreground UI → own the single-peer WS; tell the bg isolate to
  // back off so they don't fight over the desktop's one connection slot.
  // Re-send a couple of times because the bg isolate's listener may not be
  // registered yet at cold start (the first invoke would otherwise be lost,
  // letting the bg's boot-grace timer connect and fight the foreground).
  bg.invoke('app_foreground');
  Future.delayed(const Duration(seconds: 1), () => bg.invoke('app_foreground'));
  Future.delayed(const Duration(seconds: 3), () => bg.invoke('app_foreground'));
  await SyncService.instance.start();
  // Background isolate tells us when it received a clip → refresh foreground UI.
  bg.on('clip_received').listen((_) => SyncService.instance.notifyExternalChange());

  // Hand the connection back and forth as the app enters/leaves foreground.
  WidgetsBinding.instance.addObserver(_LifecycleHandoff(bg));

  // Forward content shared into Clippy from other apps → desktop.
  ShareReceiver.onMessage = (m) => clippyMessengerKey.currentState?.showSnackBar(
        SnackBar(content: Text(m), duration: const Duration(milliseconds: 1200)),
      );
  await ShareReceiver.init();

  runApp(const ClippyApp());
}

class _LifecycleHandoff extends WidgetsBindingObserver {
  final FlutterBackgroundService bg;
  _LifecycleHandoff(this.bg);

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      bg.invoke('app_foreground');        // bg backs off
      SyncService.instance.start();        // fg (re)connects
    } else if (state == AppLifecycleState.paused || state == AppLifecycleState.detached) {
      SyncService.instance.suspend();      // fg releases the WS
      bg.invoke('app_background');          // bg takes over
    }
  }
}
