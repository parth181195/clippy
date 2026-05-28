import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../theme.dart';

/// Holds the current theme mode + accent, persists them, and applies them to
/// ClippyTokens. The desktop can push both over the sync channel.
///
/// [rev] bumps on every change (mode OR accent) so a ValueListenableBuilder
/// keyed on it rebuilds the whole app even when only the accent changed.
class ThemeController {
  static final ThemeController instance = ThemeController._();
  ThemeController._();

  final _storage = const FlutterSecureStorage();
  final ValueNotifier<int> rev = ValueNotifier<int>(0);
  ClippyMode mode = ClippyMode.dark;

  Future<void> load() async {
    String? savedMode, savedAccent;
    try {
      savedMode = await _storage.read(key: 'theme');
      savedAccent = await _storage.read(key: 'accent');
    } catch (_) {}
    mode = clippyModeFromString(savedMode);
    ClippyTokens.applyMode(mode);
    ClippyTokens.applyAccent(savedAccent);
  }

  /// Local mode change (phone Settings picker).
  Future<void> set(ClippyMode m) async {
    mode = m;
    ClippyTokens.applyMode(m);
    rev.value++;
    try { await _storage.write(key: 'theme', value: m.name); } catch (_) {}
  }

  /// Apply a theme pushed from the desktop (resolved mode + accent hex).
  Future<void> applyFromDesktop(String? modeStr, String? accentHex) async {
    mode = clippyModeFromString(modeStr);
    ClippyTokens.applyMode(mode);
    ClippyTokens.applyAccent(accentHex);
    rev.value++;
    try {
      await _storage.write(key: 'theme', value: mode.name);
      if (accentHex != null) await _storage.write(key: 'accent', value: accentHex);
    } catch (_) {}
  }
}
