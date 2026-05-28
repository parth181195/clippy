import 'package:flutter/material.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:permission_handler/permission_handler.dart';
import 'app.dart';
import 'services/background_service.dart';
import 'services/db_service.dart';
import 'services/share_receiver.dart';
import 'services/sync_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await DbService.instance();
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
  bg.invoke('app_foreground');
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
