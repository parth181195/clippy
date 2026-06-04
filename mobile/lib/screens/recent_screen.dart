import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../app.dart' show ScreenHeader;
import '../services/db_service.dart';
import '../services/sync_service.dart';
import '../theme.dart';
import '../widgets/connection_chip.dart';
import 'clip_preview_screen.dart';

class RecentScreen extends StatefulWidget {
  const RecentScreen({super.key});
  @override
  State<RecentScreen> createState() => _RecentScreenState();
}

class _RecentScreenState extends State<RecentScreen> {
  List<Map<String, Object?>> _clips = [];
  final Map<int, Uint8List> _bytesById = {};
  Timer? _debouncedLoad;
  String _query = '';
  bool _syncing = false;

  Future<void> _syncNow() async {
    setState(() => _syncing = true);
    await SyncService.instance.requestSync();
    // Brief lockout so mashing the button doesn't spam SYNC_REQUEST.
    await Future.delayed(const Duration(seconds: 3));
    if (mounted) setState(() => _syncing = false);
  }

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
    final rows = await svc.db.query('clips', orderBy: 'is_pinned DESC, created_at DESC', limit: 200);
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

  Future<void> _toggleFavorite(Map<String, Object?> row) async {
    final svc = await DbService.instance();
    final cur = (row['is_favorite'] as int?) ?? 0;
    await svc.db.update('clips', {'is_favorite': cur == 0 ? 1 : 0},
        where: 'id = ?', whereArgs: [row['id']]);
    _load();
  }

  Future<void> _togglePin(Map<String, Object?> row) async {
    final svc = await DbService.instance();
    final cur = (row['is_pinned'] as int?) ?? 0;
    await svc.db.update('clips', {'is_pinned': cur == 0 ? 1 : 0},
        where: 'id = ?', whereArgs: [row['id']]);
    _load();
  }

  void _sendTo(Map<String, Object?> row) {
    final clipId = row['id'] as int?;
    if (clipId == null) return;
    final conns = SyncService.instance.connections;
    if (conns.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No paired desktops'), duration: Duration(milliseconds: 1400)),
      );
      return;
    }
    if (conns.length == 1) {
      _doSendTo(clipId, conns.first);
      return;
    }
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: ClippyTokens.surfaceRaisedDark,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 14, 20, 6),
                child: Text(
                  'Send to…',
                  style: TextStyle(
                    color: ClippyTokens.textSecDark,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.2,
                    fontFamily: 'monospace',
                  ),
                ),
              ),
              for (final c in conns)
                ListTile(
                  leading: Icon(
                    c.state == ConnState.connected ? Icons.monitor : Icons.cloud_off,
                    color: c.state == ConnState.connected
                        ? const Color(0xFF7CE8B5)
                        : ClippyTokens.textTerDark,
                  ),
                  title: Text(c.desktopName, style: TextStyle(color: ClippyTokens.textDark)),
                  subtitle: Text(
                    c.state == ConnState.connected ? 'Connected' : 'Offline — will queue',
                    style: TextStyle(color: ClippyTokens.textSecDark, fontSize: 11.5, fontFamily: 'monospace'),
                  ),
                  onTap: () { Navigator.pop(ctx); _doSendTo(clipId, c); },
                ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _doSendTo(int clipId, SyncConnection c) async {
    await SyncService.instance.sendClipToDevice(clipId: clipId, targetDeviceId: c.deviceId);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(c.state == ConnState.connected
            ? 'Sent to ${c.desktopName}'
            : 'Queued for ${c.desktopName}'),
        duration: const Duration(milliseconds: 1400),
      ),
    );
  }

  void _openSheet(Map<String, Object?> row) {
    final isFav = (row['is_favorite'] as int?) == 1;
    final isPin = (row['is_pinned'] as int?) == 1;
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: ClippyTokens.surfaceRaisedDark,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.copy_outlined),
                title: const Text('Copy'),
                onTap: () { Navigator.pop(ctx); _copy(row); },
              ),
              ListTile(
                leading: Icon(isFav ? Icons.star : Icons.star_border, color: ClippyTokens.accent),
                title: Text(isFav ? 'Unfavorite' : 'Favorite'),
                onTap: () { Navigator.pop(ctx); _toggleFavorite(row); },
              ),
              ListTile(
                leading: Icon(isPin ? Icons.push_pin : Icons.push_pin_outlined, color: ClippyTokens.accent),
                title: Text(isPin ? 'Unpin' : 'Pin'),
                onTap: () { Navigator.pop(ctx); _togglePin(row); },
              ),
              ListTile(
                leading: Icon(Icons.send_outlined, color: ClippyTokens.accent),
                title: const Text('Send to…'),
                onTap: () { Navigator.pop(ctx); _sendTo(row); },
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.delete_outline, color: Colors.redAccent),
                title: const Text('Delete', style: TextStyle(color: Colors.redAccent)),
                onTap: () { Navigator.pop(ctx); _delete(row); },
              ),
            ],
          ),
        );
      },
    );
  }

  List<Map<String, Object?>> get _filtered {
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) return _clips;
    return _clips.where((r) {
      final preview = (r['preview']?.toString() ?? '').toLowerCase();
      final source = (r['source_app']?.toString() ?? '').toLowerCase();
      return preview.contains(q) || source.contains(q);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        ScreenHeader(title: 'Recent', actions: [
          IconButton(
            onPressed: _syncing ? null : _syncNow,
            icon: _syncing
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : Icon(Icons.sync, color: ClippyTokens.textSecDark),
            tooltip: 'Sync now',
          ),
        ]),
        const Padding(
          padding: EdgeInsets.fromLTRB(16, 0, 16, 8),
          child: ConnectionChip(),
        ),
        _SearchBar(value: _query, onChanged: (v) => setState(() => _query = v)),
        Expanded(child: _buildList()),
      ],
    );
  }

  Widget _buildList() {
    final visible = _filtered;
    if (_clips.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.history, size: 32, color: ClippyTokens.textTerDark),
            const SizedBox(height: 8),
            Text('No clips yet', style: TextStyle(color: ClippyTokens.textSecDark)),
          ],
        ),
      );
    }
    if (visible.isEmpty) {
      return Center(
        child: Text('No matches for "$_query"',
            style: TextStyle(color: ClippyTokens.textSecDark)),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.only(top: 6, bottom: 120),
      itemCount: visible.length,
      separatorBuilder: (_, i) => Divider(height: 1, thickness: 1, color: ClippyTokens.borderSubtleDark, indent: 16, endIndent: 16),
      itemBuilder: (ctx, i) {
        final row = visible[i];
        return Dismissible(
          key: ValueKey(row['id']),
          background: Container(
            color: Colors.redAccent.withValues(alpha: 0.8),
            alignment: Alignment.centerRight,
            padding: const EdgeInsets.only(right: 18),
            child: const Icon(Icons.delete_outline, color: Colors.white),
          ),
          direction: DismissDirection.endToStart,
          onDismissed: (_) => _delete(row),
          child: _ClipRow(
            row: row,
            bytes: _bytesByIdFor(row),
            onTap: () async {
              final changed = await Navigator.of(context).push<bool>(
                MaterialPageRoute(builder: (_) => ClipPreviewScreen(row: row, bytes: _bytesByIdFor(row))),
              );
              if (changed == true || mounted) _load();
            },
            onLongPress: () => _openSheet(row),
          ),
        );
      },
    );
  }

  Uint8List? _bytesByIdFor(Map<String, Object?> row) {
    final id = row['id'] as int;
    final raw = row['content'];
    final bytes = _bytesById[id] ??
        (raw is List<int> ? Uint8List.fromList(raw) : null);
    if (bytes != null && !_bytesById.containsKey(id)) _bytesById[id] = bytes;
    return bytes;
  }
}

class _SearchBar extends StatelessWidget {
  final String value;
  final ValueChanged<String> onChanged;
  const _SearchBar({required this.value, required this.onChanged});
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
      child: TextField(
        onChanged: onChanged,
        controller: TextEditingController(text: value)
          ..selection = TextSelection.fromPosition(TextPosition(offset: value.length)),
        decoration: InputDecoration(
          hintText: 'Search clips…',
          hintStyle: TextStyle(color: ClippyTokens.textTerDark, fontSize: 13),
          prefixIcon: Icon(Icons.search, size: 18, color: ClippyTokens.textSecDark),
          suffixIcon: value.isNotEmpty
              ? IconButton(
                  icon: Icon(Icons.close, size: 16, color: ClippyTokens.textSecDark),
                  onPressed: () => onChanged(''),
                )
              : null,
          isDense: true,
          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          filled: true,
          fillColor: ClippyTokens.surfaceDark,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
        ),
        style: TextStyle(color: ClippyTokens.textDark, fontSize: 13),
      ),
    );
  }
}

class _ClipRow extends StatelessWidget {
  final Map<String, Object?> row;
  final Uint8List? bytes;
  final VoidCallback onTap;
  final VoidCallback onLongPress;
  const _ClipRow({required this.row, required this.bytes, required this.onTap, required this.onLongPress});

  String _relTime(int ms) {
    final d = DateTime.now().millisecondsSinceEpoch - ms;
    if (d < 60000) return 'now';
    if (d < 3600000) return '${d ~/ 60000}m';
    if (d < 86400000) return '${d ~/ 3600000}h';
    return '${d ~/ 86400000}d';
  }

  Widget _thumb(String type) {
    if (type == 'image' && bytes != null) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Image.memory(
          bytes!,
          key: ValueKey('img-${row['id']}'),
          fit: BoxFit.cover, width: 56, height: 56,
          gaplessPlayback: true,
          errorBuilder: (c, e, s) => _placeholder(type),
        ),
      );
    }
    return _placeholder(type);
  }

  Widget _placeholder(String type) {
    final icon = switch (type) {
      'file' => Icons.insert_drive_file_outlined,
      'link' => Icons.link,
      'code' => Icons.code,
      'image' => Icons.image_outlined,
      'color' => Icons.palette_outlined,
      _ => Icons.text_snippet_outlined,
    };
    return Container(
      width: 56, height: 56,
      decoration: BoxDecoration(
        color: ClippyTokens.surfaceSunkenDark,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: ClippyTokens.borderSubtleDark),
      ),
      alignment: Alignment.center,
      child: Icon(icon, size: 22, color: ClippyTokens.textTerDark),
    );
  }

  ({Color bg, Color fg}) _badge(String type) {
    switch (type) {
      case 'link':  return (bg: const Color(0x227C9CFF), fg: const Color(0xFFA6B7EA));
      case 'code':  return (bg: const Color(0x22C792EA), fg: const Color(0xFFC9A8E7));
      case 'image': return (bg: const Color(0x225BC0BE), fg: const Color(0xFF8FCFC9));
      case 'color': return (bg: const Color(0x22FFB478), fg: const Color(0xFFD9B493));
      case 'emoji': return (bg: const Color(0x22E6BD6C), fg: const Color(0xFFD9BC8A));
      case 'file':  return (bg: const Color(0x228C96AA), fg: const Color(0xFF9FA9BC));
      default:      return (bg: const Color(0x199999A8), fg: const Color(0xFFB0B0BE));
    }
  }

  @override
  Widget build(BuildContext context) {
    final preview = row['preview']?.toString() ?? '';
    final source = row['source_app']?.toString() ?? '';
    final sourceDeviceName = row['source_device_name']?.toString() ?? '';
    final type = row['content_type']?.toString() ?? 'text';
    final createdAt = (row['created_at'] as int?) ?? 0;
    final fromDesktop = sourceDeviceName.isNotEmpty || source.toLowerCase().contains('desktop');
    final fromLabel = sourceDeviceName.isNotEmpty
        ? 'FROM ${sourceDeviceName.toUpperCase()}'
        : 'FROM DESKTOP';
    final isFavorite = (row['is_favorite'] as int?) == 1;
    final isPinned = (row['is_pinned'] as int?) == 1;
    final badge = _badge(type);
    final mono = const TextStyle(fontFamily: 'monospace');

    return InkWell(
      onTap: onTap,
      onLongPress: onLongPress,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _thumb(type),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                        decoration: BoxDecoration(
                          color: badge.bg,
                          borderRadius: BorderRadius.circular(5),
                        ),
                        child: Text(
                          type.toUpperCase(),
                          style: TextStyle(
                            color: badge.fg, fontSize: 9, fontWeight: FontWeight.w600, letterSpacing: 0.4,
                          ),
                        ),
                      ),
                      if (fromDesktop) ...[
                        const SizedBox(width: 6),
                        Icon(Icons.monitor_outlined, size: 10, color: ClippyTokens.accent),
                        const SizedBox(width: 2),
                        Flexible(
                          child: Text(
                            fromLabel,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(color: ClippyTokens.accent, fontSize: 9, fontWeight: FontWeight.w700, letterSpacing: 0.4),
                          ),
                        ),
                      ],
                      if (isFavorite) ...[
                        const SizedBox(width: 6),
                        Icon(Icons.star, size: 11, color: ClippyTokens.accent),
                      ],
                      if (isPinned) ...[
                        const SizedBox(width: 4),
                        Icon(Icons.push_pin, size: 11, color: ClippyTokens.accent),
                      ],
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    type == 'code' ? preview.split('\n').first : preview,
                    maxLines: 2, overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: ClippyTokens.textDark, fontSize: 14, height: 1.4, fontWeight: FontWeight.w500,
                      fontFamily: type == 'code' ? 'monospace' : null,
                    ).merge(type == 'code' ? mono : const TextStyle()),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Text(
              createdAt > 0 ? _relTime(createdAt) : '',
              style: TextStyle(color: ClippyTokens.textTerDark, fontSize: 11, fontFamily: 'monospace'),
            ),
          ],
        ),
      ),
    );
  }
}
