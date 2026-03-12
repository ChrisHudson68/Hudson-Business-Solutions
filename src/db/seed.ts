import 'dotenv/config';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SOURCE_DB = process.env.SOURCE_DB || './instance/database.db';
const TARGET_DB = process.env.DB_PATH || './data/database.db';

const TABLES = [
  'tenants',
  'users',
  'jobs',
  'income',
  'expenses',
  'employees',
  'time_entries',
  'invoices',
  'payments',
];

function migrate() {
  if (!fs.existsSync(SOURCE_DB)) {
    console.error(`Source database not found: ${SOURCE_DB}`);
    console.log('Set SOURCE_DB environment variable to point to the existing Flask database.');
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(TARGET_DB), { recursive: true });

  const source = new Database(SOURCE_DB, { readonly: true });
  source.pragma('foreign_keys = OFF');

  const target = new Database(TARGET_DB);
  target.pragma('journal_mode = WAL');
  target.pragma('foreign_keys = OFF');

  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  target.exec(schema);

  console.log('Starting data migration...');

  for (const table of TABLES) {
    const tableExists = source.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
    ).get(table);

    if (!tableExists) {
      console.log(`  Skipping ${table} (not found in source)`);
      continue;
    }

    const rows = source.prepare(`SELECT * FROM ${table}`).all();

    if (rows.length === 0) {
      console.log(`  ${table}: 0 rows (empty)`);
      continue;
    }

    target.prepare(`DELETE FROM ${table}`).run();

    const columns = Object.keys(rows[0] as Record<string, unknown>);
    const placeholders = columns.map(() => '?').join(', ');
    const insertStmt = target.prepare(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`
    );

    const insertAll = target.transaction((data: Record<string, unknown>[]) => {
      for (const row of data) {
        insertStmt.run(...columns.map(col => (row as Record<string, unknown>)[col]));
      }
    });

    insertAll(rows as Record<string, unknown>[]);
    console.log(`  ${table}: ${rows.length} rows migrated`);
  }

  target.pragma('foreign_keys = ON');

  source.close();
  target.close();

  console.log('\nMigration complete!');
  console.log(`Source: ${SOURCE_DB}`);
  console.log(`Target: ${TARGET_DB}`);
}

migrate();
