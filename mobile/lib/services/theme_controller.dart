import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../theme.dart';

/// Holds the current theme mode, persists it, and applies it to ClippyTokens.
/// The desktop can push a new theme over the sync channel.
class ThemeController {
  static final ThemeController instance = ThemeController._();
  ThemeController._();

  final _storage = const FlutterSecureStorage();
  final notifier = ValueNotifier<ClippyMode>(ClippyMode.dark);

  Future<void> load() async {
    String? saved;
    try { saved = await _storage.read(key: 'theme'); } catch (_) {}
    final mode = clippyModeFromString(saved);
    ClippyTokens.applyMode(mode);
    notifier.value = mode;
  }

  /// Apply + persist a new mode (from settings UI or a desktop THEME push).
  Future<void> set(ClippyMode mode) async {
    if (mode == notifier.value) return;
    ClippyTokens.applyMode(mode);
    notifier.value = mode;
    try { await _storage.write(key: 'theme', value: mode.name); } catch (_) {}
  }

  Future<void> setFromString(String? s) => set(clippyModeFromString(s));
}
