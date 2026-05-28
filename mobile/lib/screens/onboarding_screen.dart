import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../services/sync_service.dart';
import '../widgets/clippy_brand_hero.dart';
import 'pairing_screen.dart';

/// First-run screen (design's MobileSplash "firstrun" state): pair with a
/// desktop now, or skip and explore unpaired. Calls [onDone] once the user has
/// either paired or chosen to skip.
class OnboardingScreen extends StatelessWidget {
  final VoidCallback onDone;
  const OnboardingScreen({super.key, required this.onDone});

  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(resetOnError: true, encryptedSharedPreferences: true),
  );

  static Future<void> markOnboarded() async {
    try {
      await _storage.write(key: 'onboarded', value: '1');
    } catch (_) {}
  }

  static Future<bool> isOnboarded() async {
    try {
      return (await _storage.read(key: 'onboarded')) == '1';
    } catch (_) {
      return false;
    }
  }

  Future<void> _pair(BuildContext context) async {
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PairingScreen()));
    if (SyncService.instance.state != ConnState.unpaired) {
      await markOnboarded();
      onDone();
    }
  }

  Future<void> _skip() async {
    await markOnboarded();
    onDone();
  }

  @override
  Widget build(BuildContext context) {
    const accent = Color(0xFFE95678);
    return ClippyBrandHero(
      tagline: 'Pair with your desktop to start syncing.',
      bottom: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () => _pair(context),
              style: FilledButton.styleFrom(
                backgroundColor: accent,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 15),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(100)),
                textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
              ),
              child: const Text('Pair with a desktop'),
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: _skip,
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFFECECF1),
                padding: const EdgeInsets.symmetric(vertical: 15),
                side: const BorderSide(color: Color(0xFF3A3A4A)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(100)),
                textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
              ),
              child: const Text('Skip for now'),
            ),
          ),
        ],
      ),
    );
  }
}
