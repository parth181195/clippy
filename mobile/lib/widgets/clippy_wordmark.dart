import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// "Clippy." wordmark — bold Inter with a coral period.
class ClippyWordmark extends StatelessWidget {
  final double size;
  final Color color;
  final Color accent;
  const ClippyWordmark({
    super.key,
    this.size = 36,
    this.color = const Color(0xFFECECF1),
    this.accent = const Color(0xFFE95678),
  });

  @override
  Widget build(BuildContext context) {
    return Text.rich(
      TextSpan(children: [
        TextSpan(text: 'Clippy', style: TextStyle(color: color)),
        TextSpan(text: '.', style: TextStyle(color: accent)),
      ]),
      style: GoogleFonts.inter(
        fontSize: size,
        fontWeight: FontWeight.w800,
        letterSpacing: -size * 0.04,
        height: 1,
      ),
    );
  }
}
