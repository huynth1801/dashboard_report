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
      period TEXT NOT NULL,
      userId TEXT NOT NULL DEFAULT 'public'
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
      userId TEXT NOT NULL DEFAULT 'public'
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
      userId TEXT NOT NULL DEFAULT 'public'
    );

    CREATE INDEX IF NOT EXISTS idx_orders_period ON orders(period);
    CREATE INDEX IF NOT EXISTS idx_orders_productShort ON orders(productShort);
    CREATE INDEX IF NOT EXISTS idx_transactions_period ON transactions(period);
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
  `);

  // Simple migration strategy: attempt to add userId column if missing
  const alterQueries = [
    `ALTER TABLE orders ADD COLUMN userId TEXT NOT NULL DEFAULT 'public';`,
    `ALTER TABLE transactions ADD COLUMN userId TEXT NOT NULL DEFAULT 'public';`,
    `ALTER TABLE upload_batches ADD COLUMN userId TEXT NOT NULL DEFAULT 'public';`,
    `ALTER TABLE product_costs ADD COLUMN userId TEXT NOT NULL DEFAULT 'public';`
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

  // Migration for product_costs: check if it has the updated composite PK
  try {
    const tableInfo = await database.execute("PRAGMA table_info(product_costs)");
    const pkColumns = (tableInfo.rows as any[]).filter(col => col.pk > 0);
    
    // If table exists but only has one PK column (productShort), migrate it
    if (tableInfo.rows.length > 0 && pkColumns.length === 1 && pkColumns[0].name === 'productShort') {
      console.log("Migrating product_costs table to composite primary key...");
      await database.batch([
        "ALTER TABLE product_costs RENAME TO product_costs_old",
        `CREATE TABLE product_costs (
          productShort TEXT NOT NULL,
          costPrice REAL NOT NULL DEFAULT 0,
          note TEXT,
          userId TEXT NOT NULL DEFAULT 'public',
          PRIMARY KEY (productShort, userId)
        )`,
        "INSERT INTO product_costs (productShort, costPrice, note, userId) SELECT productShort, costPrice, note, userId FROM product_costs_old",
        "DROP TABLE product_costs_old"
      ]);
      console.log("Migration complete.");
    }
  } catch (err) {
    console.warn("Migration for product_costs failed or not needed:", err);
  }
}
