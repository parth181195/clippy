import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import '../app.dart' show ScreenHeader;
import '../services/file_transfer_service.dart';
import '../services/sync_service.dart';
import '../theme.dart';

class SendScreen extends StatefulWidget {
  const SendScreen({super.key});
  @override
  State<SendScreen> createState() => _SendScreenState();
}

class _SendScreenState extends State<SendScreen> {
  final _ctrl = TextEditingController();
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _ctrl.addListener(() => setState(() {}));
    SyncService.instance.addListener(_onSync);
  }

  @override
  void dispose() {
    SyncService.instance.removeListener(_onSync);
    _ctrl.dispose();
    super.dispose();
  }

  void _onSync() {
    if (mounted) setState(() {});
  }

  Future<void> _send() async {
    final text = _ctrl.text.trim();
    if (text.isEmpty) return;
    setState(() => _sending = true);
    try {
      final wasConnected = SyncService.instance.state == ConnState.connected;
      await SyncService.instance.sendText(text);
      _ctrl.clear();
      if (!mounted) return;
      _toast(wasConnected ? 'Sent to desktop' : 'Queued — will send when online');
    } catch (e) {
      if (mounted) _toast('Failed: $e');
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _pickAndSend(FileType type) async {
    final res = await FilePicker.platform.pickFiles(type: type, withData: true);
    if (res == null || res.files.isEmpty) return;
    final f = res.files.single;
    final bytes = f.bytes ?? (f.path != null ? await File(f.path!).readAsBytes() : null);
    if (bytes == null) return;
    final mime = _guessMime(f.name);
    final kind = mime.startsWith('image/') ? 'image' : 'file';
    setState(() => _sending = true);
    try {
      final tid = await SyncService.instance.sendFile(bytes: bytes, mime: mime, kind: kind, name: f.name);
      if (mounted) _toast(tid != null ? 'Sending ${f.name}' : 'Not connected');
    } catch (e) {
      if (mounted) _toast('Failed: $e');
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _toast(String m) => ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(m), duration: const Duration(milliseconds: 900)),
      );

  String _guessMime(String name) {
    final l = name.toLowerCase();
    if (l.endsWith('.png')) return 'image/png';
    if (l.endsWith('.jpg') || l.endsWith('.jpeg')) return 'image/jpeg';
    if (l.endsWith('.gif')) return 'image/gif';
    if (l.endsWith('.webp')) return 'image/webp';
    if (l.endsWith('.pdf')) return 'application/pdf';
    return 'application/octet-stream';
  }

  @override
  Widget build(BuildContext context) {
    final svc = SyncService.instance;
    final connected = svc.state == ConnState.connected;
    // Text Send works offline (enqueues to outbox) as long as at least one
    // desktop is paired — files/images still need a live link.
    final hasPaired = svc.state != ConnState.unpaired;
    final transfers = svc.transfers.values.toList().reversed.toList();
    final chars = _ctrl.text.length;

    return ListView(
      padding: const EdgeInsets.only(bottom: 120),
      children: [
        const ScreenHeader(title: 'Send'),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _destinationCard(svc, connected),
              const SizedBox(height: 14),
              _composerCard(connected, hasPaired, chars),
              const SizedBox(height: 22),
              Row(
                children: [
                  Text('RECENT TRANSFERS',
                      style: TextStyle(
                        color: ClippyTokens.textTerDark, fontSize: 10.5,
                        fontWeight: FontWeight.w700, letterSpacing: 1.2, fontFamily: 'monospace',
                      )),
                ],
              ),
              const SizedBox(height: 8),
              if (transfers.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Text('No transfers yet.', style: TextStyle(color: ClippyTokens.textTerDark, fontSize: 12)),
                )
              else
                ...transfers.map(_transferRow),
            ],
          ),
        ),
      ],
    );
  }

  Widget _destinationCard(SyncService svc, bool connected) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: ClippyTokens.surfaceDark,
        border: Border.all(color: ClippyTokens.borderSubtleDark),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Text('TO', style: TextStyle(
            color: ClippyTokens.textTerDark, fontSize: 10.5, fontWeight: FontWeight.w700,
            letterSpacing: 0.8, fontFamily: 'monospace',
          )),
          const SizedBox(width: 10),
          Container(
            width: 22, height: 22,
            decoration: BoxDecoration(color: ClippyTokens.accent.withValues(alpha: 0.13), borderRadius: BorderRadius.circular(6)),
            child: Icon(Icons.monitor, size: 12, color: ClippyTokens.accent),
          ),
          const SizedBox(width: 8),
          Text(svc.desktopName ?? 'desktop',
              style: TextStyle(color: ClippyTokens.textDark, fontSize: 13, fontWeight: FontWeight.w600)),
          const SizedBox(width: 8),
          Container(width: 6, height: 6, decoration: BoxDecoration(
            color: connected ? const Color(0xFF7CE8B5) : ClippyTokens.textTerDark, shape: BoxShape.circle)),
          const Spacer(),
        ],
      ),
    );
  }

  Widget _composerCard(bool connected, bool hasPaired, int chars) {
    return Container(
      decoration: BoxDecoration(
        color: ClippyTokens.surfaceDark,
        border: Border.all(color: ClippyTokens.borderSubtleDark),
        borderRadius: BorderRadius.circular(16),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _ctrl,
            maxLines: 5, minLines: 3,
            decoration: InputDecoration(
              isCollapsed: true,
              hintText: 'Type or paste to send to desktop…',
              hintStyle: TextStyle(color: ClippyTokens.textTerDark, fontSize: 14),
              border: InputBorder.none,
            ),
            style: TextStyle(color: ClippyTokens.textDark, fontSize: 14, height: 1.5),
          ),
          const SizedBox(height: 12),
          const Divider(height: 1),
          const SizedBox(height: 10),
          Row(
            children: [
              _attachBtn(Icons.image_outlined, connected ? () => _pickAndSend(FileType.image) : null),
              _attachBtn(Icons.attach_file, connected ? () => _pickAndSend(FileType.any) : null),
              const Spacer(),
              Text('$chars chars', style: TextStyle(color: ClippyTokens.textTerDark, fontSize: 10.5, fontFamily: 'monospace')),
              const SizedBox(width: 10),
              FilledButton(
                onPressed: hasPaired && !_sending && chars > 0 ? _send : null,
                style: FilledButton.styleFrom(
                  backgroundColor: ClippyTokens.accent,
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(100)),
                ),
                child: _sending
                    ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Row(mainAxisSize: MainAxisSize.min, children: [
                        Text('Send', style: TextStyle(fontWeight: FontWeight.w600)),
                        SizedBox(width: 6), Icon(Icons.send, size: 14),
                      ]),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _attachBtn(IconData icon, VoidCallback? onTap) {
    return IconButton(
      onPressed: onTap,
      icon: Icon(icon, size: 18),
      color: ClippyTokens.textSecDark,
      visualDensity: VisualDensity.compact,
    );
  }

  Widget _transferRow(TransferProgress t) {
    final pct = (t.sent / (t.total == 0 ? 1 : t.total)).clamp(0.0, 1.0);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: ClippyTokens.surfaceDark,
        border: Border.all(color: ClippyTokens.borderSubtleDark),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(
              color: ClippyTokens.surfaceRaisedDark,
              border: Border.all(color: ClippyTokens.borderSubtleDark),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(t.kind == 'image' ? Icons.image_outlined : Icons.insert_drive_file_outlined,
                size: 18, color: ClippyTokens.textSecDark),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(t.name, maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: ClippyTokens.textDark, fontSize: 13, fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                Row(children: [
                  Icon(t.direction == 'in' ? Icons.south : Icons.north, size: 11, color: ClippyTokens.textSecDark),
                  const SizedBox(width: 4),
                  Text(
                    t.done ? 'done' : '${(pct * 100).round()}%',
                    style: TextStyle(color: t.done ? const Color(0xFF7CE8B5) : ClippyTokens.accent, fontSize: 11, fontFamily: 'monospace', fontWeight: FontWeight.w600),
                  ),
                ]),
                if (!t.done) ...[
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(2),
                    child: LinearProgressIndicator(
                      value: pct, minHeight: 3,
                      backgroundColor: ClippyTokens.surfaceRaisedDark,
                      valueColor: AlwaysStoppedAnimation(ClippyTokens.accent),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
