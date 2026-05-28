import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

enum ClippyMode { dark, light, oled }

ClippyMode clippyModeFromString(String? s) => switch (s) {
      'light' => ClippyMode.light,
      'oled' => ClippyMode.oled,
      _ => ClippyMode.dark,
    };

/// Runtime-swappable palette. Fields are intentionally non-const so changing
/// the theme at runtime (e.g. synced from desktop) updates every widget that
/// reads them on the next rebuild. The `…Dark` field names are historical —
/// they hold the *current* mode's value, not necessarily a dark one.
class ClippyTokens {
  static Color accent = const Color(0xFFE95678);

  /// Parse a #rrggbb hex (desktop accent) into the runtime accent color.
  static void applyAccent(String? hex) {
    if (hex == null) return;
    final m = RegExp(r'^#?([\da-fA-F]{6})$').firstMatch(hex.trim());
    if (m == null) return;
    accent = Color(0xFF000000 | int.parse(m.group(1)!, radix: 16));
  }

  static Color bgDark = const Color(0xFF16161F);
  static Color bgSolidDark = const Color(0xFF0E0E15);
  static Color surfaceDark = const Color(0xFF1F1F2A);
  static Color surfaceRaisedDark = const Color(0xFF2A2A38);
  static Color surfaceSunkenDark = const Color(0xFF15151C);
  static Color borderSubtleDark = const Color(0xFF2D2D3A);
  static Color borderStrongDark = const Color(0xFF3A3A4A);
  static Color textDark = const Color(0xFFECECF1);
  static Color textSecDark = const Color(0xFF9999A8);
  static Color textTerDark = const Color(0xFF5C5C6B);

  static void applyMode(ClippyMode m) {
    switch (m) {
      case ClippyMode.oled:
        bgDark = const Color(0xFF000000);
        bgSolidDark = const Color(0xFF000000);
        surfaceDark = const Color(0xFF0C0C10);
        surfaceRaisedDark = const Color(0xFF15151B);
        surfaceSunkenDark = const Color(0xFF000000);
        borderSubtleDark = const Color(0xFF1E1E26);
        borderStrongDark = const Color(0xFF2C2C36);
        textDark = const Color(0xFFECECF1);
        textSecDark = const Color(0xFF9999A8);
        textTerDark = const Color(0xFF5C5C6B);
        break;
      case ClippyMode.light:
        bgDark = const Color(0xFFF5F5FA);
        bgSolidDark = const Color(0xFFEFEFF4);
        surfaceDark = const Color(0xFFFFFFFF);
        surfaceRaisedDark = const Color(0xFFF0F0F5);
        surfaceSunkenDark = const Color(0xFFECECF1);
        borderSubtleDark = const Color(0xFFE5E5EC);
        borderStrongDark = const Color(0xFFD5D5DE);
        textDark = const Color(0xFF1A1A24);
        textSecDark = const Color(0xFF5C5C6B);
        textTerDark = const Color(0xFF9999A8);
        break;
      case ClippyMode.dark:
        bgDark = const Color(0xFF16161F);
        bgSolidDark = const Color(0xFF0E0E15);
        surfaceDark = const Color(0xFF1F1F2A);
        surfaceRaisedDark = const Color(0xFF2A2A38);
        surfaceSunkenDark = const Color(0xFF15151C);
        borderSubtleDark = const Color(0xFF2D2D3A);
        borderStrongDark = const Color(0xFF3A3A4A);
        textDark = const Color(0xFFECECF1);
        textSecDark = const Color(0xFF9999A8);
        textTerDark = const Color(0xFF5C5C6B);
        break;
    }
  }
}

ThemeData clippyThemeFor(ClippyMode m) {
  final isLight = m == ClippyMode.light;
  final brightness = isLight ? Brightness.light : Brightness.dark;
  final base = ThemeData(brightness: brightness, useMaterial3: true);
  return base.copyWith(
    scaffoldBackgroundColor: ClippyTokens.bgSolidDark,
    colorScheme: ColorScheme.fromSeed(seedColor: ClippyTokens.accent, brightness: brightness),
    textTheme: GoogleFonts.interTextTheme(base.textTheme).apply(
      bodyColor: ClippyTokens.textDark,
      displayColor: ClippyTokens.textDark,
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: ClippyTokens.bgSolidDark,
      foregroundColor: ClippyTokens.textDark,
      elevation: 0,
      titleTextStyle: GoogleFonts.inter(
        fontWeight: FontWeight.w600,
        fontSize: 20,
        color: ClippyTokens.textDark,
        letterSpacing: -0.3,
      ),
    ),
  );
}

// Back-compat shim for any caller still using the old signature.
ThemeData clippyTheme(Brightness b) => clippyThemeFor(b == Brightness.light ? ClippyMode.light : ClippyMode.dark);
