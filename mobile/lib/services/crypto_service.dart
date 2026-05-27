import 'dart:convert';
import 'dart:typed_data';
import 'package:sodium_libs/sodium_libs.dart';

class CryptoService {
  static Sodium? _sodium;
  static Future<Sodium> _ready() async => _sodium ??= await SodiumInit.init();

  /// Returns base64(nonce || ct) — same wire format as desktop encryptEnvelope.
  static Future<String> encrypt(Uint8List psk, Uint8List plaintext) async {
    final s = await _ready();
    final key = SecureKey.fromList(s, psk);
    final nonce = s.randombytes.buf(s.crypto.secretBox.nonceBytes);
    final ct = s.crypto.secretBox.easy(message: plaintext, nonce: nonce, key: key);
    key.dispose();
    final combined = Uint8List(nonce.length + ct.length)
      ..setRange(0, nonce.length, nonce)
      ..setRange(nonce.length, nonce.length + ct.length, ct);
    return base64Encode(combined);
  }

  static Future<Uint8List?> decrypt(Uint8List psk, String b64) async {
    final s = await _ready();
    final combined = base64Decode(b64);
    final nonceBytes = s.crypto.secretBox.nonceBytes;
    if (combined.length < nonceBytes) return null;
    final nonce = Uint8List.fromList(combined.sublist(0, nonceBytes));
    final ct = Uint8List.fromList(combined.sublist(nonceBytes));
    final key = SecureKey.fromList(s, psk);
    try {
      return s.crypto.secretBox.openEasy(cipherText: ct, nonce: nonce, key: key);
    } catch (_) {
      return null;
    } finally {
      key.dispose();
    }
  }
}
