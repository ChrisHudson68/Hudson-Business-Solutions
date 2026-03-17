import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';

function ensureMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function resolveSchemaPath(): string {
  const candidates = [
    path.join(process.cwd(), 'src/db/schema.sql'),
    path.join(process.cwd(), 'dist/schema.sql'),
    path.join(process.cwd(), 'dist/db/schema.sql'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error('Could not locate schema.sql for database initialization.');
}

function resolveMigrationsDir(): string | null {
  const candidates = [
    path.join(process.cwd(), 'src/db/migrations'),
    path.join(process.cwd(), 'dist/db/migrations'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }

  return null;
}

function hasCoreTables(db: Database.Database): boolean {
  const row = db
    .prepare(`
      SELECT COUNT(*) as total
      FROM sqlite_master
      WHERE type = 'table'
        AND name IN ('tenants', 'users', 'jobs', 'employees', 'time_entries', 'income', 'expenses', 'invoices', 'payments')
    `)
    .get() as { total: number };

  return Number(row?.total || 0) > 0;
}

function bootstrapSchemaIfNeeded(db: Database.Database): boolean {
  if (hasCoreTables(db)) {
    return false;
  }

  const schemaPath = resolveSchemaPath();
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8').trim();

  if (!schemaSql) {
    throw new Error('schema.sql is empty.');
  }

  db.exec(schemaSql);
  return true;
}

function getAppliedMigrationSet(db: Database.Database): Set<string> {
  const rows = db
    .prepare(`
      SELECT filename
      FROM schema_migrations
      ORDER BY filename ASC
    `)
    .all() as Array<{ filename: string }>;

  return new Set(rows.map((row) => row.filename));
}

function recordMigration(db: Database.Database, filename: string): void {
  db.prepare(`
    INSERT OR IGNORE INTO schema_migrations (filename)
    VALUES (?)
  `).run(filename);
}

function getMigrationFiles(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((name) => /^\d+.*\.sql$/i.test(name))
    .sort((a, b) => a.localeCompare(b));
}

function getTableColumns(db: Database.Database, tableName: string): Set<string> {
  const rows = db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all() as Array<{ name: string }>;

  return new Set(rows.map((row) => row.name));
}

function isMigrationAlreadySatisfied(db: Database.Database, filename: string): boolean {
  if (filename === '004_add_tenant_billing_columns.sql') {
    const tenantColumns = getTableColumns(db, 'tenants');

    const requiredColumns = [
      'billing_exempt',
      'billing_status',
      'billing_plan',
      'billing_trial_ends_at',
      'billing_grace_ends_at',
      'billing_customer_id',
      'billing_subscription_id',
      'billing_subscription_status',
      'billing_updated_at',
    ];

    return requiredColumns.every((column) => tenantColumns.has(column));
  }

  return false;
}

function shouldRunWithoutWrapperTransaction(filename: string): boolean {
  return filename === '007_make_timeclock_job_optional.sql';
}

function runMigration(db: Database.Database, filename: string, sql: string): void {
  if (shouldRunWithoutWrapperTransaction(filename)) {
    db.exec(sql);
    recordMigration(db, filename);
    return;
  }

  const tx = db.transaction(() => {
    db.exec(sql);
    recordMigration(db, filename);
  });

  tx();
}

export function migrateDatabase(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schemaBootstrapped = bootstrapSchemaIfNeeded(db);

  ensureMigrationsTable(db);

  const baselineFilename = '001_initial_schema.sql';
  const applied = getAppliedMigrationSet(db);

  if (schemaBootstrapped && !applied.has(baselineFilename)) {
    recordMigration(db, baselineFilename);
    applied.add(baselineFilename);
  }

  if (!schemaBootstrapped && hasCoreTables(db) && !applied.has(baselineFilename)) {
    recordMigration(db, baselineFilename);
    applied.add(baselineFilename);
  }

  const migrationsDir = resolveMigrationsDir();
  if (!migrationsDir) {
    return;
  }

  const migrationFiles = getMigrationFiles(migrationsDir);

  for (const filename of migrationFiles) {
    if (applied.has(filename)) {
      continue;
    }

    if (isMigrationAlreadySatisfied(db, filename)) {
      recordMigration(db, filename);
      applied.add(filename);
      continue;
    }

    const fullPath = path.join(migrationsDir, filename);
    const sql = fs.readFileSync(fullPath, 'utf-8').trim();

    if (!sql) {
      throw new Error(`Migration file "${filename}" is empty.`);
    }

    runMigration(db, filename, sql);
    applied.add(filename);
  }
}