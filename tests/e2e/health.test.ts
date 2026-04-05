import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import type { Database } from "better-sqlite3";
import { createApp } from "../../src/app.js";
import { setupTestDb, teardownTestDb } from "./helpers/db.js";

let db: Database;
const app = (() => {
  // App is created after DB is set up (in beforeAll) — use a lazy reference
  let _app: ReturnType<typeof createApp>;
  return {
    get instance() {
      return _app;
    },
    init() {
      _app = createApp();
    },
  };
})();

beforeAll(() => {
  db = setupTestDb();
  app.init();
});

afterAll(() => {
  teardownTestDb(db);
});

describe("GET /api/health", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app.instance).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.timestamp).toBe("string");
  });
});
