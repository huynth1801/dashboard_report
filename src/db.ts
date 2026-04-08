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
    CREATE TABLE IF NOT EXISTS shops (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      userId TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

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
      period TEXT NOT NULL,
      userId TEXT NOT NULL DEFAULT 'public',
      shopId TEXT
    );

    -- Upgrade existing tables if they don't have userId
    -- Warning: SQLite ALTER TABLE ADD COLUMN is limited but it supports defaults
    -- Note: In a production App, schema evolution is complex.

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      typeRaw TEXT NOT NULL,
      detail TEXT,
      orderId TEXT,
      amount REAL NOT NULL DEFAULT 0,
      period TEXT NOT NULL,
      userId TEXT NOT NULL DEFAULT 'public',
      shopId TEXT
    );

    CREATE TABLE IF NOT EXISTS product_costs (
      productShort TEXT NOT NULL,
      costPrice REAL NOT NULL DEFAULT 0,
      note TEXT,
      userId TEXT NOT NULL DEFAULT 'public',
      PRIMARY KEY (productShort, userId)
    );

    CREATE TABLE IF NOT EXISTS upload_batches (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      period TEXT NOT NULL,
      rowsImported INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      userId TEXT NOT NULL DEFAULT 'public',
      shopId TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_shops_userId ON shops(userId);
    CREATE INDEX IF NOT EXISTS idx_orders_period ON orders(period);
    CREATE INDEX IF NOT EXISTS idx_orders_productShort ON orders(productShort);
    CREATE INDEX IF NOT EXISTS idx_transactions_period ON transactions(period);
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
  `);

  // Simple migration strategy: attempt to add columns if missing
  const alterQueries = [
    `ALTER TABLE orders ADD COLUMN userId TEXT NOT NULL DEFAULT 'public';`,
    `ALTER TABLE transactions ADD COLUMN userId TEXT NOT NULL DEFAULT 'public';`,
    `ALTER TABLE upload_batches ADD COLUMN userId TEXT NOT NULL DEFAULT 'public';`,
    `ALTER TABLE product_costs ADD COLUMN userId TEXT NOT NULL DEFAULT 'public';`,
    `ALTER TABLE orders ADD COLUMN shopId TEXT;`,
    `ALTER TABLE transactions ADD COLUMN shopId TEXT;`,
    `ALTER TABLE upload_batches ADD COLUMN shopId TEXT;`,
  ];

  for (const query of alterQueries) {
    try {
      await database.execute(query);
    } catch (err: any) {
      // Ignored if column already exists (duplicate column name)
    }
  }

  // Create additional index for filtering performance
  await database.execute(`CREATE INDEX IF NOT EXISTS idx_orders_userId ON orders(userId);`);
  await database.execute(`CREATE INDEX IF NOT EXISTS idx_transactions_userId ON transactions(userId);`);
  await database.execute(`CREATE INDEX IF NOT EXISTS idx_orders_shopId ON orders(shopId);`);
  await database.execute(`CREATE INDEX IF NOT EXISTS idx_transactions_shopId ON transactions(shopId);`);

  // Migrate product_costs: add shopId to primary key (one-time migration)
  // Check if shopId column already exists in product_costs
  try {
    const colInfo = await database.execute(`PRAGMA table_info(product_costs)`);
    const hasShopId = colInfo.rows.some((r: any) => String(r.name) === 'shopId');
    if (!hasShopId) {
      // Recreate table with shopId in PK, migrate existing data as shopId = '' (general/all shops)
      await database.execute(`
        CREATE TABLE IF NOT EXISTS product_costs_v2 (
          productShort TEXT NOT NULL,
          costPrice REAL NOT NULL DEFAULT 0,
          note TEXT,
          userId TEXT NOT NULL DEFAULT 'public',
          shopId TEXT NOT NULL DEFAULT '',
          PRIMARY KEY (productShort, userId, shopId)
        )
      `);
      await database.execute(`
        INSERT OR IGNORE INTO product_costs_v2 (productShort, costPrice, note, userId, shopId)
        SELECT productShort, costPrice, note, userId, '' FROM product_costs
      `);
      await database.execute(`DROP TABLE IF EXISTS product_costs`);
      await database.execute(`ALTER TABLE product_costs_v2 RENAME TO product_costs`);
    }
  } catch (err: any) {
    console.warn('product_costs migration skipped:', err?.message);
  }
}
