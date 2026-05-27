import 'package:flutter/material.dart';
import 'app.dart';
import 'services/db_service.dart';
import 'services/sync_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await DbService.instance();
  await SyncService.instance.start();
  runApp(const ClippyApp());
}
