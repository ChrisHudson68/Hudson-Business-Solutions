import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { getEnv } from '../config/env.js';
import { migrateDatabase } from './migrate.js';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const env = getEnv();
  const dbPath = env.dbPath;

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  db = new Database(dbPath);
  migrateDatabase(db);

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export type DB = Database.Database;