import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

class DbService {
  static DbService? _instance;
  late final Database db;
  DbService._();

  static Future<DbService> instance() async {
    if (_instance != null) return _instance!;
    final dir = await getDatabasesPath();
    final svc = DbService._();
    svc.db = await openDatabase(
      p.join(dir, 'clippy.db'),
      version: 1,
      onCreate: (db, _) async {
        for (final s in _schema) {
          await db.execute(s);
        }
      },
    );
    _instance = svc;
    return svc;
  }
}

const _schema = [
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
