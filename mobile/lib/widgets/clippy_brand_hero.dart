import 'package:flutter/material.dart';
import 'clippy_mark.dart';
import 'clippy_wordmark.dart';

/// Branded launch backdrop (mirrors the design's MobileSplash): a dark radial
/// gradient with a coral aurora, the pulsing Clippy mark, the wordmark, a
/// tagline, and a [bottom] slot (spinner for splash, buttons for onboarding).
///
/// Colors are hardcoded on purpose — this screen is the same coral-on-dark
/// brand moment regardless of the user's chosen theme, so it doesn't read
/// ClippyTokens (and therefore needs no theme-rev rebuild).
class ClippyBrandHero extends StatefulWidget {
  final String tagline;
  final Widget bottom;
  const ClippyBrandHero({super.key, required this.tagline, required this.bottom});

  @override
  State<ClippyBrandHero> createState() => _ClippyBrandHeroState();
}

class _ClippyBrandHeroState extends State<ClippyBrandHero> with SingleTickerProviderStateMixin {
  static const _accent = Color(0xFFE95678);
  static const _text = Color(0xFFECECF1);
  static const _textSec = Color(0xFF9999A8);

  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1600),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0E0B14),
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment(0, 1.0),
            radius: 1.25,
            colors: [Color(0xFF2A1F2E), Color(0xFF1A1626), Color(0xFF0E0B14), Color(0xFF050308)],
            stops: [0, 0.35, 0.8, 1.0],
          ),
        ),
        child: Stack(
          children: [
            // coral aurora near the bottom
            Positioned(
              bottom: -140,
              left: 0,
              right: 0,
              height: 360,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    radius: 0.6,
                    colors: [_accent.withValues(alpha: 0.27), _accent.withValues(alpha: 0)],
                  ),
                ),
              ),
            ),
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  FadeTransition(
                    opacity: Tween<double>(begin: 0.72, end: 1).animate(
                      CurvedAnimation(parent: _pulse, curve: Curves.easeInOut),
                    ),
                    child: ScaleTransition(
                      scale: Tween<double>(begin: 0.965, end: 1).animate(
                        CurvedAnimation(parent: _pulse, curve: Curves.easeInOut),
                      ),
                      child: const ClippyMark(size: 88, fg: _text, accent: _accent),
                    ),
                  ),
                  const SizedBox(height: 22),
                  const ClippyWordmark(size: 36),
                  const SizedBox(height: 10),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 48),
                    child: Text(
                      widget.tagline,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: _textSec, fontSize: 12.5, height: 1.45, letterSpacing: -0.1),
                    ),
                  ),
                ],
              ),
            ),
            Positioned(left: 18, right: 18, bottom: 36, child: widget.bottom),
          ],
        ),
      ),
    );
  }
}
