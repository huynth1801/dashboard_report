import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import type { Database } from "better-sqlite3";
import { createApp } from "../../src/app.js";
import { setupTestDb, teardownTestDb } from "./helpers/db.js";

let db: Database;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  db = setupTestDb();
  app = createApp();
});

afterAll(() => {
  teardownTestDb(db);
});

describe("GET /api/settings/costs", () => {
  it("returns empty costs array initially", async () => {
    const res = await request(app).get("/api/settings/costs");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.costs)).toBe(true);
    expect(res.body.costs.length).toBe(0);
  });
});

describe("POST /api/settings/costs", () => {
  it("creates a new product cost entry", async () => {
    const res = await request(app).post("/api/settings/costs").send({
      productShort: "Kem mặt",
      costPrice: 75000,
      note: "Giá nhập tháng 3",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.productShort).toBe("Kem mặt");
    expect(res.body.costPrice).toBe(75000);
  });

  it("persists the entry — GET returns it", async () => {
    const res = await request(app).get("/api/settings/costs");
    expect(res.status).toBe(200);

    const kemEntry = res.body.costs.find(
      (c: { productShort: string }) => c.productShort === "Kem mặt"
    );
    expect(kemEntry).toBeDefined();
    expect(kemEntry.costPrice).toBe(75000);
    expect(kemEntry.note).toBe("Giá nhập tháng 3");
  });

  it("upserts — updating an existing product cost", async () => {
    await request(app).post("/api/settings/costs").send({
      productShort: "Kem mặt",
      costPrice: 80000,
      note: "Cập nhật giá tháng 4",
    });

    const res = await request(app).get("/api/settings/costs");
    const kemEntry = res.body.costs.find(
      (c: { productShort: string }) => c.productShort === "Kem mặt"
    );
    expect(kemEntry.costPrice).toBe(80000);
    expect(kemEntry.note).toBe("Cập nhật giá tháng 4");

    // Still only one entry for this product
    const kemCount = res.body.costs.filter(
      (c: { productShort: string }) => c.productShort === "Kem mặt"
    ).length;
    expect(kemCount).toBe(1);
  });

  it("creates multiple distinct products", async () => {
    await request(app).post("/api/settings/costs").send({
      productShort: "Serum VC",
      costPrice: 120000,
    });

    const res = await request(app).get("/api/settings/costs");
    expect(res.body.costs.length).toBeGreaterThanOrEqual(2);
  });

  it("returns 400 when productShort is missing", async () => {
    const res = await request(app).post("/api/settings/costs").send({
      costPrice: 50000,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/productShort/i);
  });

  it("returns 400 when productShort is empty string", async () => {
    const res = await request(app).post("/api/settings/costs").send({
      productShort: "   ",
      costPrice: 50000,
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when costPrice is missing", async () => {
    const res = await request(app).post("/api/settings/costs").send({
      productShort: "Son môi",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/costPrice/i);
  });

  it("returns 400 when costPrice is negative", async () => {
    const res = await request(app).post("/api/settings/costs").send({
      productShort: "Son môi",
      costPrice: -100,
    });
    expect(res.status).toBe(400);
  });

  it("accepts costPrice of 0 (free product)", async () => {
    const res = await request(app).post("/api/settings/costs").send({
      productShort: "Freebie",
      costPrice: 0,
    });
    expect(res.status).toBe(200);
    expect(res.body.costPrice).toBe(0);
  });

  it("trims whitespace from productShort", async () => {
    const res = await request(app).post("/api/settings/costs").send({
      productShort: "  Toner  ",
      costPrice: 60000,
    });
    expect(res.status).toBe(200);
    expect(res.body.productShort).toBe("Toner");
  });
});
