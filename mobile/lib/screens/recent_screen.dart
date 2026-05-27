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

  @override
  void initState() {
    super.initState();
    _load();
    SyncService.instance.addListener(_load);
  }

  @override
  void dispose() {
    SyncService.instance.removeListener(_load);
    super.dispose();
  }

  Future<void> _load() async {
    final svc = await DbService.instance();
    final rows = await svc.db.query('clips', orderBy: 'created_at DESC', limit: 200);
    debugPrint('[clippy] Recent._load: ${rows.length} rows, mounted=$mounted');
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
              onTap: () => _copy(row),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      preview,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: ClippyTokens.textDark, fontSize: 14),
                    ),
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
