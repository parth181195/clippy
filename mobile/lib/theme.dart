import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class ClippyTokens {
  static const accent = Color(0xFFE95678);

  // Dark
  static const bgDark = Color(0xFF16161F);
  static const bgSolidDark = Color(0xFF0E0E15);
  static const surfaceDark = Color(0xFF1F1F2A);
  static const surfaceRaisedDark = Color(0xFF2A2A38);
  static const surfaceSunkenDark = Color(0xFF15151C);
  static const borderSubtleDark = Color(0xFF2D2D3A);
  static const borderStrongDark = Color(0xFF3A3A4A);
  static const textDark = Color(0xFFECECF1);
  static const textSecDark = Color(0xFF9999A8);
  static const textTerDark = Color(0xFF5C5C6B);
}

ThemeData clippyTheme(Brightness b) {
  final isDark = b == Brightness.dark;
  final accent = ClippyTokens.accent;
  final base = isDark ? ThemeData.dark(useMaterial3: true) : ThemeData.light(useMaterial3: true);
  return base.copyWith(
    scaffoldBackgroundColor: isDark ? ClippyTokens.bgSolidDark : Colors.white,
    colorScheme: ColorScheme.fromSeed(seedColor: accent, brightness: b),
    textTheme: GoogleFonts.interTextTheme(base.textTheme).apply(
      bodyColor: isDark ? ClippyTokens.textDark : null,
      displayColor: isDark ? ClippyTokens.textDark : null,
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: isDark ? ClippyTokens.bgSolidDark : Colors.white,
      foregroundColor: isDark ? ClippyTokens.textDark : Colors.black,
      elevation: 0,
      titleTextStyle: GoogleFonts.inter(
        fontWeight: FontWeight.w600,
        fontSize: 20,
        color: isDark ? ClippyTokens.textDark : Colors.black,
        letterSpacing: -0.3,
      ),
    ),
  );
}
