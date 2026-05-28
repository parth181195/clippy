import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Whether automatic crash/error reporting (Sentry) is enabled. Persisted and
/// read by Sentry's `beforeSend`, so toggling it takes effect without a restart.
/// Defaults ON for the beta; the user can opt out in Settings.
class ErrorReporting {
  static final ErrorReporting instance = ErrorReporting._();
  ErrorReporting._();

  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(resetOnError: true, encryptedSharedPreferences: true),
  );

  bool enabled = true;

  Future<void> load() async {
    try {
      enabled = (await _storage.read(key: 'error_reporting')) != 'false';
    } catch (_) {
      enabled = true;
    }
  }

  Future<void> set(bool value) async {
    enabled = value;
    try {
      await _storage.write(key: 'error_reporting', value: value.toString());
    } catch (_) {}
  }
}
