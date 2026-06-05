import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:sodium_libs/sodium_libs_sumo.dart';

/// Encrypted export/import of the phone's pairings and ed25519 identity (M18).
///
/// On-disk format (base64-encoded once for sharing as a single string):
///
///   "CLPY1"  | salt (sodium pwhash) | nonce (secretbox) | ciphertext
///
/// The key is Argon2id derived from a user passphrase. Losing the passphrase
/// is unrecoverable by design.
class PairingsBackup {
  static const _headerStr = 'CLPY1';
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(resetOnError: true, encryptedSharedPreferences: true),
  );

  static Future<SodiumSumo> _sodium() async => SodiumSumoInit.init();

  static Future<String> export(String passphrase) async {
    final sodium = await _sodium();

    final pairings = await _storage.read(key: 'pairings');
    final deviceId = await _storage.read(key: 'device_id');
    final pubKey = await _storage.read(key: 'device_public_key');
    final privKey = await _storage.read(key: 'device_private_key');
    final phoneName = await _storage.read(key: 'phone_name');

    final payload = jsonEncode({
      'v': 1,
      'pairings': pairings == null ? [] : jsonDecode(pairings),
      'device_id': deviceId,
      'device_public_key': pubKey,
      'device_private_key': privKey,
      'phone_name': phoneName,
    });
    final plaintext = Uint8List.fromList(utf8.encode(payload));

    final salt = sodium.randombytes.buf(sodium.crypto.pwhash.saltBytes);
    final key = sodium.crypto.pwhash.call(
      outLen: sodium.crypto.secretBox.keyBytes,
      password: Int8List.fromList(utf8.encode(passphrase)),
      salt: salt,
      opsLimit: sodium.crypto.pwhash.opsLimitInteractive,
      memLimit: sodium.crypto.pwhash.memLimitInteractive,
      alg: CryptoPwhashAlgorithm.argon2id13,
    );

    final nonce = sodium.randombytes.buf(sodium.crypto.secretBox.nonceBytes);
    final ct = sodium.crypto.secretBox.easy(
      message: plaintext,
      nonce: nonce,
      key: key,
    );
    key.dispose();

    final headerBytes = Uint8List.fromList(utf8.encode(_headerStr));
    final out = Uint8List(headerBytes.length + salt.length + nonce.length + ct.length);
    var off = 0;
    out.setRange(off, off + headerBytes.length, headerBytes); off += headerBytes.length;
    out.setRange(off, off + salt.length, salt); off += salt.length;
    out.setRange(off, off + nonce.length, nonce); off += nonce.length;
    out.setRange(off, off + ct.length, ct);
    return base64Encode(out);
  }

  /// Decrypt + write pairings + identity back to secure storage. Returns true
  /// on success, false on wrong passphrase. Throws FormatException for an
  /// unrecognised blob (wrong header / truncated).
  static Future<bool> importBlob(String blob, String passphrase) async {
    final sodium = await _sodium();
    final raw = base64Decode(blob.trim());
    if (raw.length < _headerStr.length) {
      throw const FormatException('Backup too short');
    }
    final header = utf8.decode(raw.sublist(0, _headerStr.length));
    if (header != _headerStr) {
      throw FormatException('Not a Clippy backup (header=$header)');
    }
    final saltLen = sodium.crypto.pwhash.saltBytes;
    final nonceLen = sodium.crypto.secretBox.nonceBytes;
    if (raw.length < _headerStr.length + saltLen + nonceLen) {
      throw const FormatException('Backup truncated');
    }
    var off = _headerStr.length;
    final salt = Uint8List.fromList(raw.sublist(off, off + saltLen)); off += saltLen;
    final nonce = Uint8List.fromList(raw.sublist(off, off + nonceLen)); off += nonceLen;
    final ct = Uint8List.fromList(raw.sublist(off));

    final key = sodium.crypto.pwhash.call(
      outLen: sodium.crypto.secretBox.keyBytes,
      password: Int8List.fromList(utf8.encode(passphrase)),
      salt: salt,
      opsLimit: sodium.crypto.pwhash.opsLimitInteractive,
      memLimit: sodium.crypto.pwhash.memLimitInteractive,
      alg: CryptoPwhashAlgorithm.argon2id13,
    );

    Uint8List pt;
    try {
      pt = sodium.crypto.secretBox.openEasy(
        cipherText: ct,
        nonce: nonce,
        key: key,
      );
    } catch (_) {
      key.dispose();
      return false; // wrong passphrase
    } finally {
      key.dispose();
    }

    final m = jsonDecode(utf8.decode(pt)) as Map<String, dynamic>;
    final pairings = m['pairings'];
    final deviceId = m['device_id'] as String?;
    final pubKey = m['device_public_key'] as String?;
    final privKey = m['device_private_key'] as String?;
    final phoneName = m['phone_name'] as String?;

    if (pairings is List) {
      await _storage.write(key: 'pairings', value: jsonEncode(pairings));
      if (pairings.isNotEmpty) {
        await _storage.write(key: 'pairing', value: jsonEncode(pairings.first));
      }
    }
    if (deviceId != null) await _storage.write(key: 'device_id', value: deviceId);
    if (pubKey != null) await _storage.write(key: 'device_public_key', value: pubKey);
    if (privKey != null) await _storage.write(key: 'device_private_key', value: privKey);
    if (phoneName != null) await _storage.write(key: 'phone_name', value: phoneName);
    return true;
  }
}
