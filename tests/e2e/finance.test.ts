import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import type { Database } from "better-sqlite3";
import { createApp } from "../../src/app.js";
import { setupTestDb, teardownTestDb } from "./helpers/db.js";
import {
  createBalanceXlsx,
  SAMPLE_TRANSACTIONS,
  TEST_PERIOD,
} from "./fixtures/xlsx.js";

let db: Database;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  db = setupTestDb();
  app = createApp();

  const buf = createBalanceXlsx(SAMPLE_TRANSACTIONS);
  await request(app)
    .post("/api/upload/balance")
    .attach("file", buf, {
      filename: "balance.xlsx",
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
});

afterAll(() => {
  teardownTestDb(db);
});

describe("GET /api/finance", () => {
  it("requires period query param", async () => {
    const res = await request(app).get("/api/finance");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/period/i);
  });

  it("rejects malformed period", async () => {
    const res = await request(app).get("/api/finance?period=03-2024");
    expect(res.status).toBe(400);
  });

  it("returns transaction list for seeded period", async () => {
    const res = await request(app).get(`/api/finance?period=${TEST_PERIOD}`);
    expect(res.status).toBe(200);
    expect(res.body.period).toBe(TEST_PERIOD);
    expect(Array.isArray(res.body.transactions)).toBe(true);
    expect(res.body.transactions.length).toBe(SAMPLE_TRANSACTIONS.length);
  });

  it("each transaction has required fields", async () => {
    const res = await request(app).get(`/api/finance?period=${TEST_PERIOD}`);
    for (const tx of res.body.transactions as Array<Record<string, unknown>>) {
      expect(typeof tx.id).toBe("string");
      expect(typeof tx.date).toBe("string");
      expect(typeof tx.type).toBe("string");
      expect(typeof tx.typeRaw).toBe("string");
      expect(typeof tx.amount).toBe("number");
    }
  });

  it("transaction types are properly classified", async () => {
    const res = await request(app).get(`/api/finance?period=${TEST_PERIOD}`);
    const types = res.body.transactions.map(
      (tx: { type: string }) => tx.type
    ) as string[];

    // "Thanh toán đơn hàng" → order_payment (×2), "Phí hoa hồng" → commission_fee (×1), "Hoàn tiền người mua" → return_refund (×1)
    expect(types.filter((t) => t === "order_payment").length).toBe(2);
    expect(types.filter((t) => t === "commission_fee").length).toBe(1);
    expect(types.filter((t) => t === "return_refund").length).toBe(1);
  });

  it("returns summary grouped by type", async () => {
    const res = await request(app).get(`/api/finance?period=${TEST_PERIOD}`);
    expect(Array.isArray(res.body.summary)).toBe(true);
    expect(res.body.summary.length).toBeGreaterThan(0);

    for (const s of res.body.summary as Array<{
      type: string;
      total: number;
      count: number;
    }>) {
      expect(typeof s.type).toBe("string");
      expect(typeof s.total).toBe("number");
      expect(typeof s.count).toBe("number");
    }
  });

  it("returns 3-month comparison array", async () => {
    const res = await request(app).get(`/api/finance?period=${TEST_PERIOD}`);
    expect(Array.isArray(res.body.comparison)).toBe(true);
    expect(res.body.comparison.length).toBe(3);

    const currentMonth = res.body.comparison.find(
      (c: { period: string }) => c.period === TEST_PERIOD
    );
    expect(currentMonth).toBeDefined();
  });

  it("returns empty transactions for period with no data", async () => {
    const res = await request(app).get("/api/finance?period=2020-01");
    expect(res.status).toBe(200);
    expect(res.body.transactions).toHaveLength(0);
    expect(res.body.summary).toHaveLength(0);
  });
});
