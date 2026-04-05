import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import type { Database } from "better-sqlite3";
import { createApp } from "../../src/app.js";
import { setupTestDb, teardownTestDb } from "./helpers/db.js";
import {
  createOrderXlsx,
  SAMPLE_ORDERS,
  TEST_PERIOD,
} from "./fixtures/xlsx.js";

let db: Database;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  db = setupTestDb();
  app = createApp();

  const buf = createOrderXlsx(SAMPLE_ORDERS);
  await request(app)
    .post("/api/upload/orders")
    .attach("file", buf, {
      filename: "orders.xlsx",
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
});

afterAll(() => {
  teardownTestDb(db);
});

describe("GET /api/products", () => {
  it("requires period query param", async () => {
    const res = await request(app).get("/api/products");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/period/i);
  });

  it("rejects malformed period", async () => {
    const res = await request(app).get("/api/products?period=march-2024");
    expect(res.status).toBe(400);
  });

  it("returns product rankings for the seeded period", async () => {
    const res = await request(app).get(`/api/products?period=${TEST_PERIOD}`);
    expect(res.status).toBe(200);
    expect(res.body.period).toBe(TEST_PERIOD);
    expect(Array.isArray(res.body.products)).toBe(true);

    // We have 2 distinct product shorts from 3 completed orders
    expect(res.body.products.length).toBe(2);
  });

  it("includes variant breakdown per product", async () => {
    const res = await request(app).get(`/api/products?period=${TEST_PERIOD}`);
    const products = res.body.products as Array<{
      productShort: string;
      variants: unknown[];
      totalUnits: number;
      totalRevenue: number;
    }>;

    for (const product of products) {
      expect(Array.isArray(product.variants)).toBe(true);
      expect(typeof product.totalUnits).toBe("number");
      expect(typeof product.totalRevenue).toBe("number");
    }
  });

  it("default sort is by units descending", async () => {
    const res = await request(app).get(`/api/products?period=${TEST_PERIOD}`);
    const products = res.body.products as Array<{ totalUnits: number }>;
    for (let i = 1; i < products.length; i++) {
      expect(products[i - 1].totalUnits).toBeGreaterThanOrEqual(
        products[i].totalUnits
      );
    }
  });

  it("supports sortBy=revenue", async () => {
    const res = await request(app).get(
      `/api/products?period=${TEST_PERIOD}&sortBy=revenue`
    );
    expect(res.status).toBe(200);
    const products = res.body.products as Array<{ totalRevenue: number }>;
    for (let i = 1; i < products.length; i++) {
      expect(products[i - 1].totalRevenue).toBeGreaterThanOrEqual(
        products[i].totalRevenue
      );
    }
  });

  it("respects limit param", async () => {
    const res = await request(app).get(
      `/api/products?period=${TEST_PERIOD}&limit=1`
    );
    expect(res.status).toBe(200);
    expect(res.body.products.length).toBeLessThanOrEqual(1);
  });

  it("returns empty products for period with no data", async () => {
    const res = await request(app).get("/api/products?period=2020-01");
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(0);
  });

  it("excludes cancelled orders (non-completed) from rankings", async () => {
    // ORD-004 (Đã hủy - Son môi) should not appear in products
    const res = await request(app).get(`/api/products?period=${TEST_PERIOD}`);
    const productShorts = res.body.products.map(
      (p: { productShort: string }) => p.productShort
    );
    // Son môi should not be present since its only order was cancelled
    const hasCancelledProduct = productShorts.some((s: string) =>
      s.toLowerCase().includes("son")
    );
    expect(hasCancelledProduct).toBe(false);
  });

  it("accounts for Set N variant multiplier in totalUnits", async () => {
    // ORD-002 has variant "Set 3", quantity 1 → unitCount = 3 * 1 = 3
    const res = await request(app).get(`/api/products?period=${TEST_PERIOD}`);
    const products = res.body.products as Array<{
      productShort: string;
      totalUnits: number;
    }>;

    // "Serum vitamin C Gold" with "Set 3" variant: 3 units
    const serumProduct = products.find((p) =>
      p.productShort.toLowerCase().includes("serum")
    );
    if (serumProduct) {
      expect(serumProduct.totalUnits).toBe(3);
    }
  });
});
