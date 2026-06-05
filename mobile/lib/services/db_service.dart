import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

class DbService {
  static DbService? _instance;
  late final Database db;
  DbService._();

  static const _kVersion = 2;

  static Future<DbService> instance() async {
    if (_instance != null) return _instance!;
    final dir = await getDatabasesPath();
    final svc = DbService._();
    svc.db = await openDatabase(
      p.join(dir, 'clippy.db'),
      version: _kVersion,
      onCreate: (db, _) async {
        for (final s in _schemaV1) {
          await db.execute(s);
        }
        for (final s in _v2Adds) {
          await db.execute(s);
        }
      },
      onUpgrade: (db, oldV, _) async {
        if (oldV < 2) {
          for (final s in _v2Adds) {
            await db.execute(s);
          }
        }
      },
    );
    _instance = svc;
    return svc;
  }
}

const _schemaV1 = [
  '''CREATE TABLE clips (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       content_type TEXT NOT NULL,
       mime TEXT NOT NULL,
       content BLOB NOT NULL,
       content_hash TEXT NOT NULL UNIQUE,
       preview TEXT,
       source_app TEXT,
       is_favorite INTEGER NOT NULL DEFAULT 0,
       is_pinned INTEGER NOT NULL DEFAULT 0,
       created_at INTEGER NOT NULL
     )''',
  'CREATE INDEX idx_clips_created ON clips(created_at DESC)',
];

// v2: multi-pair additions — network provenance on clips + per-target outbox.
const _v2Adds = [
  'ALTER TABLE clips ADD COLUMN source_device_id TEXT',
  'ALTER TABLE clips ADD COLUMN source_device_name TEXT',
  '''CREATE TABLE outbox (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       target_device_id TEXT NOT NULL,
       kind TEXT NOT NULL,
       clip_id INTEGER REFERENCES clips(id) ON DELETE SET NULL,
       payload_blob BLOB,
       meta_json TEXT,
       created_at INTEGER NOT NULL,
       attempts INTEGER NOT NULL DEFAULT 0,
       last_error TEXT
     )''',
  'CREATE INDEX idx_outbox_target ON outbox(target_device_id, created_at)',
];
