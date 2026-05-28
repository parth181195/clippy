import 'package:flutter/material.dart';
import '../widgets/clippy_brand_hero.dart';

/// Branded launch splash — logo + spinner while the app boots and decides
/// where to route. Shown by [LaunchGate].
class SplashScreen extends StatelessWidget {
  final String status;
  const SplashScreen({super.key, this.status = 'Connecting…'});

  @override
  Widget build(BuildContext context) {
    return ClippyBrandHero(
      tagline: 'Your clipboard, on every device.',
      bottom: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const SizedBox(
            width: 13,
            height: 13,
            child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFE95678)),
          ),
          const SizedBox(width: 9),
          Text(
            status,
            style: const TextStyle(
              color: Color(0xFF9999A8),
              fontSize: 11.5,
              fontFamily: 'monospace',
              letterSpacing: 0.4,
            ),
          ),
        ],
      ),
    );
  }
}
