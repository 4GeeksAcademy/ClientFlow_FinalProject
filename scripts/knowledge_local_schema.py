"""Add ticket #31 columns to the existing local demo SQLite database only.

Shared/PostgreSQL schema changes belong to the coordinated migration ticket #43.
"""
import sqlite3
from datetime import datetime
from pathlib import Path

path = Path(__file__).resolve().parents[1] / '.local' / 'auth-demo.db'
if not path.is_file():
    raise SystemExit('Local demo database not found; no changes made.')
columns = {
    'knowledge_documents': {'ingestion_error': 'TEXT', 'processing_token': 'VARCHAR(64)'},
    'knowledge_chunks': {'embedding': 'JSON', 'embedding_model': 'VARCHAR(100)', 'embedding_dimensions': 'INTEGER'},
}
with sqlite3.connect(path) as connection:
    missing = []
    for table, additions in columns.items():
        existing = {row[1] for row in connection.execute(f'PRAGMA table_info({table})')}
        if not existing:
            raise SystemExit(f'Required table missing: {table}; no changes made.')
        missing.extend((table, name, kind) for name, kind in additions.items() if name not in existing)
    if not missing:
        print('Knowledge schema already up to date.')
    else:
        backup = path.with_name('auth-demo-backup-' + datetime.now().strftime('%Y%m%d-%H%M%S-%f') + '.db')
        with sqlite3.connect(backup) as target:
            connection.backup(target)
        connection.execute('BEGIN')
        for table, name, kind in missing:
            connection.execute(f'ALTER TABLE {table} ADD COLUMN {name} {kind}')
        connection.commit()
        print(f'Backup created: {backup.name}')
        print(f'Local knowledge schema updated: {len(missing)} columns.')
