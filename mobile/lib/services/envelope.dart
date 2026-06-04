class Envelope {
  final String type;
  final String id;
  final int ts;
  final String plugin;
  final Map<String, dynamic> payload;
  /// Optional sender attribution; populated by SyncPool for multi-pair routing.
  final Map<String, String>? from;

  Envelope({
    required this.type,
    required this.id,
    required this.ts,
    required this.plugin,
    required this.payload,
    this.from,
  });

  factory Envelope.fromJson(Map<String, dynamic> j) => Envelope(
        type: j['type'] as String,
        id: j['id'] as String,
        ts: (j['ts'] as num).toInt(),
        plugin: j['plugin'] as String,
        payload: Map<String, dynamic>.from(j['payload'] as Map),
        from: j['from'] is Map
            ? (j['from'] as Map).map((k, v) => MapEntry(k.toString(), v.toString()))
            : null,
      );

  Map<String, dynamic> toJson() => {
        'type': type,
        'id': id,
        'ts': ts,
        'plugin': plugin,
        'payload': payload,
        if (from != null) 'from': from,
      };
}

String newUuidV4() {
  // Lightweight UUIDv4 — sufficient for envelope IDs.
  final now = DateTime.now().microsecondsSinceEpoch;
  final r1 = (now ^ (now >> 13)) & 0xffff;
  final r2 = ((now * 0x5851f42d4c957f2d) & 0xffffffff).toRadixString(16).padLeft(8, '0');
  final r3 = ((now * 0x14057b7ef767814f) & 0xffff).toRadixString(16).padLeft(4, '0');
  return '$r2-$r3-4${(r1 & 0xfff).toRadixString(16).padLeft(3, '0')}-'
      '${(8 | (r1 >> 12)).toRadixString(16)}${(r1 & 0xfff).toRadixString(16).padLeft(3, '0')}-'
      '${now.toRadixString(16).padLeft(12, '0').substring(0, 12)}';
}
