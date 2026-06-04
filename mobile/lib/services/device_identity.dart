import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:sodium_libs/sodium_libs.dart';

/// This phone's long-lived ed25519 identity. Generated once on first launch
/// and persisted in secure storage; never re-rolled (re-pairing per desktop
/// is what changes; the device identity is stable).
class DeviceIdentity {
  static final DeviceIdentity instance = DeviceIdentity._();
  DeviceIdentity._();

  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(resetOnError: true, encryptedSharedPreferences: true),
  );

  String deviceId = '';
  Uint8List publicKey = Uint8List(0);
  Uint8List _privateKey = Uint8List(0); // 64-byte libsodium ed25519 secret-key form

  Sodium? _sodium;
  Future<Sodium> _ready() async => _sodium ??= await SodiumInit.init();

  /// Read or generate the identity. Idempotent — calling it twice is safe and
  /// the second call short-circuits.
  Future<void> load() async {
    if (deviceId.isNotEmpty) return;
    final sodium = await _ready();

    final existingId = await _safeRead('device_id');
    final pub = await _safeRead('device_public_key');
    final priv = await _safeRead('device_private_key');
    if (existingId != null && pub != null && priv != null) {
      deviceId = existingId;
      publicKey = base64Decode(pub);
      _privateKey = base64Decode(priv);
      return;
    }

    // First launch — generate.
    final kp = sodium.crypto.sign.keyPair();
    deviceId =
        'clippy-phone-${sodium.randombytes.buf(8).map((b) => b.toRadixString(16).padLeft(2, '0')).join()}';
    publicKey = Uint8List.fromList(kp.publicKey);
    _privateKey = kp.secretKey.extractBytes();
    kp.secretKey.dispose();

    try {
      await _storage.write(key: 'device_id', value: deviceId);
      await _storage.write(key: 'device_public_key', value: base64Encode(publicKey));
      await _storage.write(key: 'device_private_key', value: base64Encode(_privateKey));
    } catch (_) {}
  }

  /// Sign `message` with this device's private key (ed25519 detached).
  Future<Uint8List> sign(Uint8List message) async {
    final sodium = await _ready();
    final sk = SecureKey.fromList(sodium, _privateKey);
    try {
      return sodium.crypto.sign.detached(message: message, secretKey: sk);
    } finally {
      sk.dispose();
    }
  }

  Future<String?> _safeRead(String key) async {
    try {
      return await _storage.read(key: key);
    } catch (_) {
      return null;
    }
  }
}
