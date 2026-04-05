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

beforeAll(async () => {
  db = setupTestDb();
  app = createApp();

  // Seed: upload orders then balance so dashboard has data
  const ordersBuf = createOrderXlsx(SAMPLE_ORDERS);
  const balanceBuf = createBalanceXlsx(SAMPLE_TRANSACTIONS);

  await request(app)
    .post("/api/upload/orders")
    .attach("file", ordersBuf, {
      filename: "orders.xlsx",
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

  await request(app)
    .post("/api/upload/balance")
    .attach("file", balanceBuf, {
      filename: "balance.xlsx",
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
});

afterAll(() => {
  teardownTestDb(db);
});

describe("GET /api/dashboard", () => {
  it("requires period query param", async () => {
    const res = await request(app).get("/api/dashboard");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/period/i);
  });

  it("rejects malformed period", async () => {
    const res = await request(app).get("/api/dashboard?period=2024-3");
    expect(res.status).toBe(400);
  });

  it("returns KPIs for a seeded period", async () => {
    const res = await request(app).get(`/api/dashboard?period=${TEST_PERIOD}`);
    expect(res.status).toBe(200);
    expect(res.body.period).toBe(TEST_PERIOD);

    const { kpis } = res.body;
    expect(kpis).toBeDefined();

    // 3 completed orders: ORD-001 (300k), ORD-002 (450k), ORD-003 (150k)
    expect(kpis.totalOrders).toBe(3);
    expect(kpis.totalRevenue).toBeCloseTo(900000);
  });

  it("returns dailySeries array", async () => {
    const res = await request(app).get(`/api/dashboard?period=${TEST_PERIOD}`);
    expect(Array.isArray(res.body.dailySeries)).toBe(true);
    // We have orders on 3 different days
    expect(res.body.dailySeries.length).toBe(3);
  });

  it("returns waterfall breakdown", async () => {
    const res = await request(app).get(`/api/dashboard?period=${TEST_PERIOD}`);
    expect(Array.isArray(res.body.waterfall)).toBe(true);
    expect(res.body.waterfall.length).toBeGreaterThan(0);

    const grossItem = res.body.waterfall.find((w: { label: string }) =>
      w.label.includes("Doanh thu gộp")
    );
    expect(grossItem).toBeDefined();
    expect(grossItem.value).toBeCloseTo(900000);
  });

  it("returns prevRevenue comparison array", async () => {
    const res = await request(app).get(`/api/dashboard?period=${TEST_PERIOD}`);
    expect(Array.isArray(res.body.prevRevenue)).toBe(true);
    expect(res.body.prevRevenue.length).toBe(3);
  });

  it("returns empty KPIs for a period with no data", async () => {
    const res = await request(app).get("/api/dashboard?period=2020-01");
    expect(res.status).toBe(200);
    expect(res.body.kpis.totalOrders).toBe(0);
    expect(res.body.kpis.totalRevenue).toBe(0);
    expect(res.body.dailySeries).toHaveLength(0);
  });

  it("reflects commission fees in netRevenue calculation", async () => {
    const res = await request(app).get(`/api/dashboard?period=${TEST_PERIOD}`);
    const { kpis } = res.body;
    // commission_fee = 45000, refund = 150000
    // netRevenue = 900000 - 150000 - 45000 = 705000
    expect(kpis.netRevenue).toBeCloseTo(705000);
    expect(kpis.totalFees).toBeCloseTo(45000);
    expect(kpis.totalRefunds).toBeCloseTo(150000);
  });
});
