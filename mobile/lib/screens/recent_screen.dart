import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/db_service.dart';
import '../services/sync_service.dart';
import '../theme.dart';

class RecentScreen extends StatefulWidget {
  const RecentScreen({super.key});
  @override
  State<RecentScreen> createState() => _RecentScreenState();
}

class _RecentScreenState extends State<RecentScreen> {
  List<Map<String, Object?>> _clips = [];
  final Map<int, Uint8List> _bytesById = {};
  Timer? _debouncedLoad;

  @override
  void initState() {
    super.initState();
    _load();
    SyncService.instance.addListener(_scheduleLoad);
  }

  @override
  void dispose() {
    SyncService.instance.removeListener(_scheduleLoad);
    _debouncedLoad?.cancel();
    super.dispose();
  }

  void _scheduleLoad() {
    _debouncedLoad?.cancel();
    _debouncedLoad = Timer(const Duration(milliseconds: 300), _load);
  }

  Future<void> _load() async {
    final svc = await DbService.instance();
    final rows = await svc.db.query('clips', orderBy: 'created_at DESC', limit: 200);
    final currentIds = <int>{};
    for (final r in rows) {
      final id = r['id'] as int;
      currentIds.add(id);
      final raw = r['content'];
      // sqflite returns _UnmodifiableUint8ArrayView; always copy so
      // Image.memory gets a real Uint8List it can decode.
      if (!_bytesById.containsKey(id) && raw is List<int>) {
        _bytesById[id] = Uint8List.fromList(raw);
      }
    }
    _bytesById.removeWhere((id, _) => !currentIds.contains(id));
    if (!mounted) return;
    setState(() => _clips = rows);
  }

  Future<void> _copy(Map<String, Object?> row) async {
    final bytes = row['content'];
    String text = '';
    if (bytes is List<int>) {
      try { text = utf8.decode(bytes); } catch (_) { text = row['preview']?.toString() ?? ''; }
    }
    await Clipboard.setData(ClipboardData(text: text));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Copied'), duration: Duration(milliseconds: 700)),
    );
  }

  Future<void> _delete(Map<String, Object?> row) async {
    final svc = await DbService.instance();
    await svc.db.delete('clips', where: 'id = ?', whereArgs: [row['id']]);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_clips.isEmpty) {
      return Center(
        child: Text('No clips yet', style: TextStyle(color: ClippyTokens.textSecDark)),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: _clips.length,
      separatorBuilder: (_, i) => const SizedBox(height: 6),
      itemBuilder: (ctx, i) {
        final row = _clips[i];
        final preview = row['preview']?.toString() ?? '';
        final source = row['source_app']?.toString() ?? '';
        final type = row['content_type']?.toString() ?? 'text';
        final id = row['id'] as int;
        final raw = row['content'];
        // Cache hit → stable bytes ref (no decode thrash). Miss → fall back
        // to fresh-copy bytes so the row still renders this frame.
        final bytes = _bytesById[id] ??
            (raw is List<int> ? Uint8List.fromList(raw) : null);
        if (type == 'image' && bytes != null && !_bytesById.containsKey(id)) {
          _bytesById[id] = bytes;
        }
        Widget body;
        if (type == 'image' && bytes != null) {
          body = Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.memory(
                  bytes,
                  key: ValueKey('img-$id'),
                  fit: BoxFit.cover,
                  height: 160,
                  width: double.infinity,
                  gaplessPlayback: true,
                  errorBuilder: (ctx, err, st) => Container(
                    height: 160, color: ClippyTokens.surfaceSunkenDark,
                    alignment: Alignment.center,
                    child: Icon(Icons.broken_image_outlined,
                        color: ClippyTokens.textTerDark),
                  ),
                ),
              ),
              if (preview.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(preview, style: TextStyle(color: ClippyTokens.textSecDark, fontSize: 11)),
              ],
            ],
          );
        } else if (type == 'file') {
          body = Row(
            children: [
              Icon(Icons.insert_drive_file_outlined, color: ClippyTokens.textSecDark),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  preview,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: ClippyTokens.textDark, fontSize: 13),
                ),
              ),
              if (bytes != null)
                Text('${(bytes.length / 1024).toStringAsFixed(1)} KB',
                    style: TextStyle(color: ClippyTokens.textTerDark, fontSize: 11)),
            ],
          );
        } else {
          body = Text(
            preview,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: ClippyTokens.textDark, fontSize: 14),
          );
        }
        return Dismissible(
          key: ValueKey(row['id']),
          background: Container(color: Colors.redAccent),
          onDismissed: (_) => _delete(row),
          child: Card(
            margin: const EdgeInsets.symmetric(horizontal: 12),
            color: ClippyTokens.surfaceDark,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            child: InkWell(
              borderRadius: BorderRadius.circular(10),
              onTap: type == 'image' || type == 'file' ? null : () => _copy(row),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    body,
                    if (source.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(source, style: TextStyle(color: ClippyTokens.textTerDark, fontSize: 11)),
                    ],
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
