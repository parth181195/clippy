import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:receive_sharing_intent/receive_sharing_intent.dart';
import 'sync_service.dart';

/// Handles content shared *into* Clippy from other apps (Android share sheet).
/// Each shared item is forwarded to the paired desktop. Surfaces a message
/// via [onMessage] so the UI can toast (esp. the unpaired case).
class ShareReceiver {
  static StreamSubscription? _sub;
  static void Function(String message)? onMessage;

  static Future<void> init() async {
    // Cold-start case: the app was launched *by* a share intent. Must be read
    // explicitly — the stream below only fires for shares while we're alive.
    try {
      final initial = await ReceiveSharingIntent.instance.getInitialMedia();
      if (initial.isNotEmpty) {
        await _handle(initial);
        ReceiveSharingIntent.instance.reset();
      }
    } catch (e) {
      debugPrint('[clippy] initial share read failed: $e');
    }

    _sub?.cancel();
    _sub = ReceiveSharingIntent.instance.getMediaStream().listen(
      (items) => _handle(items),
      onError: (e) => debugPrint('[clippy] share stream error: $e'),
    );
  }

  static Future<void> _handle(List<SharedMediaFile> items) async {
    if (items.isEmpty) return;
    final svc = SyncService.instance;
    if (svc.state != ConnState.connected) {
      onMessage?.call('No paired device — open Clippy to pair');
      return;
    }
    var sent = 0;
    for (final item in items) {
      try {
        switch (item.type) {
          case SharedMediaType.text:
          case SharedMediaType.url:
            await svc.sendText(item.path);
            sent++;
            break;
          case SharedMediaType.image:
          case SharedMediaType.file:
          case SharedMediaType.video:
            final f = File(item.path);
            if (!await f.exists()) break;
            final bytes = await f.readAsBytes();
            final mime = item.mimeType ?? 'application/octet-stream';
            final kind = mime.startsWith('image/') ? 'image' : 'file';
            await svc.sendFile(bytes: bytes, mime: mime, kind: kind, name: item.path.split('/').last);
            sent++;
            break;
        }
      } catch (e) {
        debugPrint('[clippy] share forward failed: $e');
      }
    }
    if (sent > 0) {
      onMessage?.call(sent == 1 ? 'Sent to ${svc.desktopName ?? 'desktop'}' : 'Sent $sent items to desktop');
    }
  }

  static void dispose() {
    _sub?.cancel();
    _sub = null;
  }
}
