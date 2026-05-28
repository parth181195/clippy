import 'package:flutter/material.dart';

/// The Clippy mark (MarkClipboard) drawn from the brand spec: a clipboard body
/// in [accent] with a binder-clip bar + hanger in [fg] and luminance-aware page
/// lines. Geometry mirrors assets/brand/icon.svg (64-unit viewBox).
class ClippyMark extends StatelessWidget {
  final double size;
  final Color fg;
  final Color accent;
  const ClippyMark({super.key, this.size = 64, required this.fg, required this.accent});

  @override
  Widget build(BuildContext context) =>
      CustomPaint(size: Size.square(size), painter: _MarkPainter(fg: fg, accent: accent));
}

class _MarkPainter extends CustomPainter {
  final Color fg;
  final Color accent;
  _MarkPainter({required this.fg, required this.accent});

  Color get _line {
    final lum = 0.299 * accent.r + 0.587 * accent.g + 0.114 * accent.b;
    return lum > 0.55 ? const Color(0xFF1A1A24) : const Color(0xFFFFFFFF);
  }

  RRect _rr(double x, double y, double w, double h, double r, double s) =>
      RRect.fromRectAndRadius(Rect.fromLTWH(x * s, y * s, w * s, h * s), Radius.circular(r * s));

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 64.0;
    final bodyP = Paint()..color = accent;
    final fgP = Paint()..color = fg;
    final hangerP = Paint()..color = fg.withValues(alpha: 0.85);

    canvas.drawRRect(_rr(13, 17, 38, 42, 4, s), bodyP);
    canvas.drawRRect(_rr(17, 11, 30, 9, 2, s), fgP);
    canvas.drawRRect(_rr(27, 6, 10, 4, 1.5, s), hangerP);

    final line = _line;
    void drawLine(double x1, double y1, double x2, double y2, double op) {
      final p = Paint()
        ..color = line.withValues(alpha: op)
        ..strokeWidth = 2.2 * s
        ..strokeCap = StrokeCap.round;
      canvas.drawLine(Offset(x1 * s, y1 * s), Offset(x2 * s, y2 * s), p);
    }

    drawLine(20, 29, 44, 29, 0.92);
    drawLine(20, 36, 40, 36, 0.85);
    drawLine(20, 43, 42, 43, 0.70);
    drawLine(20, 50, 34, 50, 0.60);
  }

  @override
  bool shouldRepaint(_MarkPainter old) => old.fg != fg || old.accent != accent;
}
