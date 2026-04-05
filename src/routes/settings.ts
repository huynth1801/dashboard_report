import { Router, Request, Response } from "express";
import { getDb } from "../db.js";

const router = Router();

// GET /api/settings/costs
router.get("/costs", (_req: Request, res: Response) => {
  const db = getDb();
  const costs = db
    .prepare(`SELECT productShort, costPrice, note FROM product_costs ORDER BY productShort ASC`)
    .all() as Array<{ productShort: string; costPrice: number; note: string }>;
  res.json({ costs });
});

// POST /api/settings/costs
router.post("/costs", (req: Request, res: Response) => {
  const { productShort, costPrice, note } = req.body as {
    productShort?: string;
    costPrice?: number;
    note?: string;
  };

  if (!productShort || typeof productShort !== "string" || productShort.trim() === "") {
    res.status(400).json({ error: "productShort is required" });
    return;
  }

  if (costPrice === undefined || costPrice === null || typeof costPrice !== "number" || costPrice < 0) {
    res.status(400).json({ error: "costPrice must be a non-negative number" });
    return;
  }

  const db = getDb();
  db.prepare(
    `INSERT INTO product_costs (productShort, costPrice, note)
     VALUES (?, ?, ?)
     ON CONFLICT(productShort) DO UPDATE SET costPrice = excluded.costPrice, note = excluded.note`
  ).run(productShort.trim(), costPrice, note ?? null);

  res.json({ success: true, productShort: productShort.trim(), costPrice });
});

// GET /api/settings/periods
router.get("/periods", (_req: Request, res: Response) => {
  const db = getDb();
  const periods = db
    .prepare(
      `SELECT DISTINCT period FROM orders
       UNION
       SELECT DISTINCT period FROM transactions
       ORDER BY period DESC`
    )
    .all() as Array<{ period: string }>;
  res.json({ periods: periods.map((p) => p.period) });
});

export default router;
