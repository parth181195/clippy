import 'package:flutter/material.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:permission_handler/permission_handler.dart';
import 'app.dart';
import 'services/background_service.dart';
import 'services/db_service.dart';
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
  await SyncService.instance.start();
  // Background isolate tells us when it received a clip → refresh foreground UI.
  FlutterBackgroundService().on('clip_received').listen((_) {
    SyncService.instance.notifyExternalChange();
  });
  runApp(const ClippyApp());
}
