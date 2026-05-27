import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
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
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _ctrl.text.trim();
    if (text.isEmpty) return;
    setState(() => _sending = true);
    try {
      await SyncService.instance.sendText(text);
      _ctrl.clear();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sent to desktop'), duration: Duration(milliseconds: 900)),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
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
    final name = f.name;
    final mime = _guessMime(name);
    final kind = mime.startsWith('image/') ? 'image' : 'file';
    setState(() => _sending = true);
    try {
      final tid = await SyncService.instance.sendFile(bytes: bytes, mime: mime, kind: kind, name: name);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(tid != null ? 'Sent $name' : 'Not connected'), duration: const Duration(seconds: 1)),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

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
    final connected = SyncService.instance.state == ConnState.connected;
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: TextField(
              controller: _ctrl,
              maxLines: null,
              expands: true,
              textAlignVertical: TextAlignVertical.top,
              decoration: InputDecoration(
                hintText: 'Type or paste to send to desktop…',
                hintStyle: TextStyle(color: ClippyTokens.textTerDark),
                filled: true,
                fillColor: ClippyTokens.surfaceDark,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide.none,
                ),
              ),
              style: TextStyle(color: ClippyTokens.textDark, fontSize: 14),
            ),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: connected && !_sending ? _send : null,
            icon: _sending
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.send),
            label: Text(connected ? 'Send text' : 'Not connected'),
            style: FilledButton.styleFrom(
              backgroundColor: ClippyTokens.accent,
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: connected && !_sending ? () => _pickAndSend(FileType.image) : null,
                  icon: const Icon(Icons.image_outlined),
                  label: const Text('Send image'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: ClippyTokens.textDark,
                    side: BorderSide(color: ClippyTokens.borderStrongDark),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: connected && !_sending ? () => _pickAndSend(FileType.any) : null,
                  icon: const Icon(Icons.attach_file),
                  label: const Text('Send file'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: ClippyTokens.textDark,
                    side: BorderSide(color: ClippyTokens.borderStrongDark),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
