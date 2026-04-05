/**
 * Test DB helpers — create and tear down an in-memory SQLite instance
 * that is injected into the app module before each test suite.
 */

import Database from "better-sqlite3";
import { setTestDb, resetTestDb, runMigrations } from "../../../src/db.js";

/**
 * Creates an in-memory SQLite database, runs all migrations, and injects it
 * into the db module singleton. Call in beforeAll().
 */
export function setupTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  setTestDb(db);
  // runMigrations calls getDb() which returns our injected in-memory DB
  runMigrations();
  return db;
}

/**
 * Closes the in-memory DB and resets the singleton. Call in afterAll().
 */
export function teardownTestDb(db: Database.Database): void {
  resetTestDb();
  db.close();
}
