import { createClient, Client } from "@libsql/client";
import { mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DB_PATH = path.join(__dirname, "..", "data", "shopee.db");

let _db: Client | null = null;

export function getDb(): Client {
  if (!_db) {
    const url = process.env.TURSO_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (url) {
      // Connect to remote Turso Database
      _db = createClient({ url, authToken });
    } else {
      // Fallback to local SQLite file
      mkdirSync(path.dirname(DB_PATH), { recursive: true });
      _db = createClient({ url: `file:${DB_PATH}` });
    }
  }
  return _db;
}

/** For testing only — replaces the module-level DB singleton. */
export function setTestDb(db: Client): void {
  _db = db;
}

/** For testing only — clears the singleton so getDb() creates a fresh instance. */
export function resetTestDb(): void {
  _db = null;
}

export async function runMigrations(): Promise<void> {
  const database = getDb();

  await database.executeMultiple(`
    CREATE TABLE IF NOT EXISTS orders (
      orderId TEXT PRIMARY KEY,
      orderDate TEXT NOT NULL,
      status TEXT NOT NULL,
      isCompleted INTEGER NOT NULL DEFAULT 0,
      productName TEXT NOT NULL,
      productShort TEXT NOT NULL,
      sku TEXT,
      variant TEXT,
      quantity INTEGER NOT NULL DEFAULT 0,
      unitCount INTEGER NOT NULL DEFAULT 1,
      revenue REAL NOT NULL DEFAULT 0,
      period TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      typeRaw TEXT NOT NULL,
      detail TEXT,
      orderId TEXT,
      amount REAL NOT NULL DEFAULT 0,
      period TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS product_costs (
      productShort TEXT PRIMARY KEY,
      costPrice REAL NOT NULL DEFAULT 0,
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS upload_batches (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      period TEXT NOT NULL,
      rowsImported INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_orders_period ON orders(period);
    CREATE INDEX IF NOT EXISTS idx_orders_productShort ON orders(productShort);
    CREATE INDEX IF NOT EXISTS idx_transactions_period ON transactions(period);
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
  `);
}
