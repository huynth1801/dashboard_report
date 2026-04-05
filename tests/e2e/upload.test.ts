import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import type { Database } from "better-sqlite3";
import { createApp } from "../../src/app.js";
import { setupTestDb, teardownTestDb } from "./helpers/db.js";
import {
  createOrderXlsx,
  createBalanceXlsx,
  SAMPLE_ORDERS,
  SAMPLE_TRANSACTIONS,
  TEST_PERIOD,
} from "./fixtures/xlsx.js";

let db: Database;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  db = setupTestDb();
  app = createApp();
});

afterAll(() => {
  teardownTestDb(db);
});

describe("POST /api/upload/orders", () => {
  it("uploads a valid orders XLSX and returns import summary", async () => {
    const fileBuffer = createOrderXlsx(SAMPLE_ORDERS);

    const res = await request(app)
      .post("/api/upload/orders")
      .attach("file", fileBuffer, {
        filename: "orders.xlsx",
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

    expect(res.status).toBe(200);
    expect(res.body.period).toBe(TEST_PERIOD);
    // Only completed orders are imported (3 of 4 — "Đã hủy" is skipped)
    expect(res.body.rowsImported).toBe(3);
    expect(typeof res.body.batchId).toBe("string");
  });

  it("returns 400 when no file is attached", async () => {
    const res = await request(app).post("/api/upload/orders");
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("rejects non-xlsx files", async () => {
    const res = await request(app)
      .post("/api/upload/orders")
      .attach("file", Buffer.from("not a spreadsheet"), {
        filename: "data.csv",
        contentType: "text/csv",
      });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("is idempotent — re-uploading the same orders does not duplicate rows", async () => {
    const fileBuffer = createOrderXlsx(SAMPLE_ORDERS);

    const res1 = await request(app)
      .post("/api/upload/orders")
      .attach("file", fileBuffer, {
        filename: "orders.xlsx",
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
    expect(res1.status).toBe(200);

    const res2 = await request(app)
      .post("/api/upload/orders")
      .attach("file", fileBuffer, {
        filename: "orders.xlsx",
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
    expect(res2.status).toBe(200);

    // Row count should be the same — ON CONFLICT DO UPDATE prevents duplicates
    const orderCount = db
      .prepare("SELECT COUNT(*) as cnt FROM orders")
      .get() as { cnt: number };
    expect(orderCount.cnt).toBe(3);
  });
});

describe("POST /api/upload/balance", () => {
  it("uploads a valid balance XLSX and returns import summary", async () => {
    const fileBuffer = createBalanceXlsx(SAMPLE_TRANSACTIONS);

    const res = await request(app)
      .post("/api/upload/balance")
      .attach("file", fileBuffer, {
        filename: "balance.xlsx",
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

    expect(res.status).toBe(200);
    expect(res.body.period).toBe(TEST_PERIOD);
    expect(res.body.rowsImported).toBe(SAMPLE_TRANSACTIONS.length);
    expect(typeof res.body.batchId).toBe("string");
  });

  it("returns 400 when no file is attached", async () => {
    const res = await request(app).post("/api/upload/balance");
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("is idempotent — re-uploading the same transactions does not duplicate rows", async () => {
    const fileBuffer = createBalanceXlsx(SAMPLE_TRANSACTIONS);

    await request(app)
      .post("/api/upload/balance")
      .attach("file", fileBuffer, {
        filename: "balance.xlsx",
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

    await request(app)
      .post("/api/upload/balance")
      .attach("file", fileBuffer, {
        filename: "balance.xlsx",
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

    const txCount = db
      .prepare("SELECT COUNT(*) as cnt FROM transactions")
      .get() as { cnt: number };
    expect(txCount.cnt).toBe(SAMPLE_TRANSACTIONS.length);
  });
});
