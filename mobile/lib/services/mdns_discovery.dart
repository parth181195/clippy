import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:multicast_dns/multicast_dns.dart';

/// Resolve the current LAN address of the desktop by querying mDNS for
/// the `_clippy._tcp.local` service that the desktop advertises.
///
/// Returns `(host, port)` of the first responder or null on timeout / nothing
/// found. Stops the client before returning.
class MdnsDiscovery {
  static const _service = '_clippy._tcp.local';

  static Future<({String host, int port})?> findDesktop({
    Duration timeout = const Duration(seconds: 4),
  }) async {
    final client = MDnsClient();
    try {
      await client.start();
      final ptrs = client
          .lookup<PtrResourceRecord>(ResourceRecordQuery.serverPointer(_service))
          .timeout(timeout, onTimeout: (sink) => sink.close());
      await for (final ptr in ptrs) {
        final srvs = client
            .lookup<SrvResourceRecord>(ResourceRecordQuery.service(ptr.domainName))
            .timeout(timeout, onTimeout: (sink) => sink.close());
        await for (final srv in srvs) {
          final ips = client
              .lookup<IPAddressResourceRecord>(
                  ResourceRecordQuery.addressIPv4(srv.target))
              .timeout(timeout, onTimeout: (sink) => sink.close());
          await for (final ip in ips) {
            final addr = ip.address.address;
            debugPrint('[clippy] mDNS resolved $_service → $addr:${srv.port}');
            return (host: addr, port: srv.port);
          }
        }
      }
    } catch (e) {
      debugPrint('[clippy] mDNS lookup failed: $e');
    } finally {
      client.stop();
    }
    return null;
  }
}
