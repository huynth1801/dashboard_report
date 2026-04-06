import { Router, Request, Response } from "express";
import { getDb } from "../db.js";

const router = Router();

// GET /api/settings/costs
router.get("/costs", async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const rs = await db.execute(`SELECT productShort, costPrice, note FROM product_costs ORDER BY productShort ASC`);
    const costs = rs.rows.map(r => ({
      productShort: String(r.productShort),
      costPrice: Number(r.costPrice ?? 0),
      note: String(r.note ?? "")
    }));
    res.json({ costs });
  } catch (err) {
    console.error("Settings error:", err);
    res.status(500).json({ error: "Failed to fetch costs" });
  }
});

// POST /api/settings/costs
router.post("/costs", async (req: Request, res: Response) => {
  try {
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
    await db.execute({
      sql: `INSERT INTO product_costs (productShort, costPrice, note)
         VALUES (?, ?, ?)
         ON CONFLICT(productShort) DO UPDATE SET costPrice = excluded.costPrice, note = excluded.note`,
      args: [productShort.trim(), costPrice, note ?? null]
    });

    res.json({ success: true, productShort: productShort.trim(), costPrice });
  } catch (err) {
    console.error("Settings error:", err);
    res.status(500).json({ error: "Failed to save costs" });
  }
});

// GET /api/settings/periods
router.get("/periods", async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const rs = await db.execute(`SELECT DISTINCT period FROM orders
         UNION
         SELECT DISTINCT period FROM transactions
         ORDER BY period DESC`);
    const periods = rs.rows.map((p) => String(p.period));
    res.json({ periods });
  } catch (err) {
    console.error("Periods error:", err);
    res.status(500).json({ error: "Failed to fetch periods" });
  }
});

export default router;
