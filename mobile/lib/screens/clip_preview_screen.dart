import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:gal/gal.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/db_service.dart';
import '../theme.dart';

class ClipPreviewScreen extends StatefulWidget {
  final Map<String, Object?> row;
  final Uint8List? bytes;
  const ClipPreviewScreen({super.key, required this.row, required this.bytes});

  @override
  State<ClipPreviewScreen> createState() => _ClipPreviewScreenState();
}

class _ClipPreviewScreenState extends State<ClipPreviewScreen> {
  late bool _favorite = (widget.row['is_favorite'] as int?) == 1;

  String get _type => widget.row['content_type']?.toString() ?? 'text';
  String get _preview => widget.row['preview']?.toString() ?? '';
  String get _source => widget.row['source_app']?.toString() ?? '';
  int get _id => widget.row['id'] as int;

  String _text() {
    final b = widget.bytes;
    if (b != null) {
      try { return utf8.decode(b); } catch (_) {}
    }
    return _preview;
  }

  String _relTime() {
    final ms = (widget.row['created_at'] as int?) ?? 0;
    if (ms == 0) return '';
    final d = DateTime.now().millisecondsSinceEpoch - ms;
    if (d < 60000) return 'now';
    if (d < 3600000) return '${d ~/ 60000}m';
    if (d < 86400000) return '${d ~/ 3600000}h';
    return '${d ~/ 86400000}d';
  }

  Future<void> _copy() async {
    if (_type == 'image' || _type == 'file') {
      // Copy the name/preview for non-text; OS clipboard can't hold our bytes.
      await Clipboard.setData(ClipboardData(text: _preview));
    } else {
      await Clipboard.setData(ClipboardData(text: _text()));
    }
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Copied'), duration: Duration(milliseconds: 700)),
    );
  }

  Future<void> _saveToGallery() async {
    final b = widget.bytes;
    if (b == null) return;
    try {
      if (!await Gal.hasAccess()) {
        final granted = await Gal.requestAccess();
        if (!granted) {
          if (mounted) _snack('Gallery permission denied');
          return;
        }
      }
      final name = (_preview.isNotEmpty ? _preview.split('/').last : 'clippy-$_id')
          .replaceAll(RegExp(r'\.[^.]+$'), '');
      await Gal.putImageBytes(b, name: name);
      // gal writes via MediaStore, which broadcasts so the Gallery app finds it.
      if (mounted) _snack('Saved to gallery');
    } on GalException catch (e) {
      if (mounted) _snack('Save failed: ${e.type.message}');
    } catch (e) {
      if (mounted) _snack('Save failed');
    }
  }

  void _snack(String m) => ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(m), duration: const Duration(milliseconds: 900)),
      );

  Future<void> _share() async {
    final b = widget.bytes;
    if ((_type == 'image' || _type == 'file') && b != null) {
      final dir = await getTemporaryDirectory();
      final name = _preview.isNotEmpty ? _preview.split('/').last : 'clip-$_id';
      final f = File('${dir.path}/$name');
      await f.writeAsBytes(b);
      await SharePlus.instance.share(ShareParams(files: [XFile(f.path)]));
    } else {
      await SharePlus.instance.share(ShareParams(text: _text()));
    }
  }

  Future<void> _toggleFavorite() async {
    final svc = await DbService.instance();
    final next = _favorite ? 0 : 1;
    await svc.db.update('clips', {'is_favorite': next}, where: 'id = ?', whereArgs: [_id]);
    setState(() => _favorite = !_favorite);
  }

  Future<void> _delete() async {
    final svc = await DbService.instance();
    await svc.db.delete('clips', where: 'id = ?', whereArgs: [_id]);
    if (mounted) Navigator.of(context).pop(true);
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

  String _meta() {
    switch (_type) {
      case 'text': return '${_text().length} chars · ${_text().split('\n').length} lines';
      case 'code': return '${_text().length} chars';
      case 'file': return widget.bytes != null ? '${(widget.bytes!.length / 1024).toStringAsFixed(1)} KB' : '';
      case 'image': return widget.bytes != null ? '${(widget.bytes!.length / 1024).toStringAsFixed(1)} KB' : '';
      case 'link': return _text().replaceFirst(RegExp(r'^https?://(www\.)?'), '').split('/').first;
      case 'color': return 'HEX · RGB · HSL';
      default: return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ClippyTokens.bgSolidDark,
      body: SafeArea(
        child: Column(
          children: [
            // top bar
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 6, 8, 10),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.arrow_back),
                    color: ClippyTokens.textDark,
                  ),
                  const Spacer(),
                  if (_source.toLowerCase().contains('desktop')) ...[
                    Container(width: 5, height: 5, decoration: BoxDecoration(color: ClippyTokens.accent, shape: BoxShape.circle)),
                    const SizedBox(width: 6),
                    Text('FROM DESKTOP · ${_relTime()}',
                        style: TextStyle(color: ClippyTokens.textSecDark, fontSize: 11, letterSpacing: 0.8, fontFamily: 'monospace')),
                  ] else
                    Text(_relTime(),
                        style: TextStyle(color: ClippyTokens.textSecDark, fontSize: 11, fontFamily: 'monospace')),
                  const Spacer(),
                  const SizedBox(width: 40),
                ],
              ),
            ),
            // body
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 18),
                child: _body(),
              ),
            ),
            // metadata strip
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
              decoration: BoxDecoration(
                border: Border(top: BorderSide(color: ClippyTokens.borderSubtleDark)),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                    decoration: BoxDecoration(color: _badge(_type).bg, borderRadius: BorderRadius.circular(5)),
                    child: Text(_type.toUpperCase(),
                        style: TextStyle(color: _badge(_type).fg, fontSize: 9, fontWeight: FontWeight.w600, letterSpacing: 0.4)),
                  ),
                  const Spacer(),
                  Text(_meta(), style: TextStyle(color: ClippyTokens.textSecDark, fontSize: 11, fontFamily: 'monospace')),
                ],
              ),
            ),
            // action bar
            Container(
              padding: const EdgeInsets.fromLTRB(18, 12, 18, 16),
              decoration: BoxDecoration(
                color: ClippyTokens.bgSolidDark,
                border: Border(top: BorderSide(color: ClippyTokens.borderSubtleDark)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: _copy,
                      icon: const Icon(Icons.copy, size: 16),
                      label: const Text('Copy'),
                      style: FilledButton.styleFrom(
                        backgroundColor: ClippyTokens.accent,
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(100)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _share,
                      icon: const Icon(Icons.ios_share, size: 16),
                      label: const Text('Share'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: ClippyTokens.textDark,
                        side: BorderSide(color: ClippyTokens.borderStrongDark),
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(100)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  _circle(
                    icon: _favorite ? Icons.star : Icons.star_border,
                    color: ClippyTokens.accent,
                    active: _favorite,
                    onTap: _toggleFavorite,
                  ),
                  const SizedBox(width: 8),
                  _circle(icon: Icons.delete_outline, color: Colors.redAccent, onTap: _delete),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _circle({required IconData icon, required Color color, bool active = false, required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(100),
      child: Container(
        width: 46, height: 46,
        decoration: BoxDecoration(
          color: active ? color.withValues(alpha: 0.15) : Colors.transparent,
          border: Border.all(color: active ? color : ClippyTokens.borderStrongDark),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, size: 18, color: active ? color : ClippyTokens.textSecDark),
      ),
    );
  }

  Widget _body() {
    switch (_type) {
      case 'image':
        if (widget.bytes != null) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(14),
                    child: Container(
                      color: ClippyTokens.surfaceSunkenDark,
                      width: double.infinity,
                      child: InteractiveViewer(
                        child: Image.memory(widget.bytes!, fit: BoxFit.contain),
                      ),
                    ),
                  ),
                ),
              ),
              OutlinedButton.icon(
                onPressed: _saveToGallery,
                icon: const Icon(Icons.download, size: 16),
                label: const Text('Save to gallery'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: ClippyTokens.textDark,
                  side: BorderSide(color: ClippyTokens.borderStrongDark),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(100)),
                ),
              ),
              const SizedBox(height: 8),
            ],
          );
        }
        return _card(child: Icon(Icons.broken_image_outlined, color: ClippyTokens.textTerDark, size: 48));
      case 'color':
        return _colorBody();
      case 'code':
        return _codeBody();
      case 'emoji':
        return _card(
          center: true,
          child: Text(_preview, style: const TextStyle(fontSize: 120)),
        );
      case 'file':
        return _fileBody();
      case 'link':
        return _linkBody();
      case 'text':
      default:
        return _card(
          child: SingleChildScrollView(
            child: Text(_text(),
                style: TextStyle(color: ClippyTokens.textDark, fontSize: 15, height: 1.6)),
          ),
        );
    }
  }

  Future<void> _openUrl() async {
    var url = _text().trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://$url';
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not open link')));
    }
  }

  Widget _linkBody() {
    final url = _text().trim();
    final host = url.replaceFirst(RegExp(r'^https?://(www\.)?'), '').split('/').first;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(children: [
                Container(
                  width: 32, height: 32,
                  decoration: BoxDecoration(color: ClippyTokens.accent, borderRadius: BorderRadius.circular(8)),
                  alignment: Alignment.center,
                  child: Text((host.isNotEmpty ? host[0] : '?').toUpperCase(),
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                ),
                const SizedBox(width: 10),
                Expanded(child: Text(host, style: TextStyle(color: ClippyTokens.textSecDark, fontSize: 12, fontFamily: 'monospace'))),
              ]),
              const SizedBox(height: 12),
              Text(url, style: TextStyle(color: ClippyTokens.textDark, fontSize: 15, height: 1.5)),
            ],
          ),
        ),
        const SizedBox(height: 8),
        FilledButton.icon(
          onPressed: _openUrl,
          icon: const Icon(Icons.open_in_new, size: 16),
          label: const Text('Open in browser'),
          style: FilledButton.styleFrom(
            backgroundColor: ClippyTokens.accent,
            padding: const EdgeInsets.symmetric(vertical: 13),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(100)),
          ),
        ),
      ],
    );
  }

  Widget _card({required Widget child, bool center = false}) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(20),
      alignment: center ? Alignment.center : null,
      decoration: BoxDecoration(
        color: ClippyTokens.surfaceDark,
        border: Border.all(color: ClippyTokens.borderSubtleDark),
        borderRadius: BorderRadius.circular(14),
      ),
      child: child,
    );
  }

  Widget _codeBody() {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: ClippyTokens.bgSolidDark,
        border: Border.all(color: ClippyTokens.borderSubtleDark),
        borderRadius: BorderRadius.circular(14),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              border: Border(bottom: BorderSide(color: ClippyTokens.borderSubtleDark)),
            ),
            child: Row(children: [
              _dot(const Color(0xFFE95678)), const SizedBox(width: 6),
              _dot(const Color(0xFFE6BC6C)), const SizedBox(width: 6),
              _dot(const Color(0xFF7CE8B5)),
              const Spacer(),
              Text('${_text().split('\n').length} lines',
                  style: TextStyle(color: ClippyTokens.textTerDark, fontSize: 10, fontFamily: 'monospace', letterSpacing: 0.6)),
            ]),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(14),
              child: Text(_text(),
                  style: TextStyle(color: ClippyTokens.textDark, fontSize: 12.5, height: 1.6, fontFamily: 'monospace')),
            ),
          ),
        ],
      ),
    );
  }

  Widget _dot(Color c) => Container(width: 9, height: 9, decoration: BoxDecoration(color: c, shape: BoxShape.circle));

  Widget _colorBody() {
    final hex = _text().trim();
    final m = RegExp(r'^#?([\da-fA-F]{6})$').firstMatch(hex);
    Color? color;
    int r = 0, g = 0, b = 0;
    if (m != null) {
      final n = int.parse(m.group(1)!, radix: 16);
      r = (n >> 16) & 0xff; g = (n >> 8) & 0xff; b = n & 0xff;
      color = Color(0xFF000000 | n);
    }
    final formats = <(String, String)>[
      ('HEX', hex.toUpperCase()),
      if (m != null) ('RGB', 'rgb($r, $g, $b)'),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          height: 180,
          margin: const EdgeInsets.only(bottom: 16),
          decoration: BoxDecoration(
            color: color ?? ClippyTokens.surfaceDark,
            borderRadius: BorderRadius.circular(16),
          ),
          alignment: Alignment.bottomLeft,
          padding: const EdgeInsets.all(16),
          child: Text(hex.toUpperCase(),
              style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w600, fontFamily: 'monospace')),
        ),
        ...formats.map((f) => GestureDetector(
              onTap: () async {
                await Clipboard.setData(ClipboardData(text: f.$2));
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Copied ${f.$1}'), duration: const Duration(milliseconds: 700)));
                }
              },
              child: Container(
                margin: const EdgeInsets.only(bottom: 6),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: ClippyTokens.surfaceDark,
                  border: Border.all(color: ClippyTokens.borderSubtleDark),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(children: [
                  SizedBox(width: 48, child: Text(f.$1, style: TextStyle(color: ClippyTokens.textTerDark, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1, fontFamily: 'monospace'))),
                  Expanded(child: Text(f.$2, style: TextStyle(color: ClippyTokens.textDark, fontSize: 13, fontFamily: 'monospace'))),
                  Icon(Icons.copy, size: 14, color: ClippyTokens.textSecDark),
                ]),
              ),
            )),
      ],
    );
  }

  Widget _fileBody() {
    return _card(
      center: true,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.insert_drive_file_outlined, size: 72, color: ClippyTokens.textSecDark),
          const SizedBox(height: 18),
          Text(_preview, textAlign: TextAlign.center,
              style: TextStyle(color: ClippyTokens.textDark, fontSize: 17, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text(_meta(), style: TextStyle(color: ClippyTokens.textSecDark, fontSize: 12, fontFamily: 'monospace')),
          const SizedBox(height: 18),
          FilledButton.icon(
            onPressed: _share,
            icon: const Icon(Icons.save_alt, size: 16),
            label: const Text('Save to Files'),
            style: FilledButton.styleFrom(
              backgroundColor: ClippyTokens.accent,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(100)),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 11),
            ),
          ),
        ],
      ),
    );
  }
}
