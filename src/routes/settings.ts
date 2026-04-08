import { Router, Request, Response } from "express";
import { getDb } from "../db.js";

const router = Router();

// GET /api/settings/costs?shopId=...
// shopId = '' or omitted → costs for "all shops / general" (default fallback)
router.get("/costs", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const shopId = String(req.query.shopId ?? "").trim();
    const db = getDb();
    const rs = await db.execute({
      sql: `SELECT productShort, costPrice, note, shopId FROM product_costs WHERE userId = ? AND shopId = ? ORDER BY productShort ASC`,
      args: [userId, shopId]
    });
    const costs = rs.rows.map((r: any) => ({
      productShort: String(r.productShort),
      costPrice: Number(r.costPrice ?? 0),
      note: String(r.note ?? ""),
      shopId: String(r.shopId ?? ""),
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
    const userId = (req as any).userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { productShort, costPrice, note, shopId } = req.body as {
      productShort?: string;
      costPrice?: number;
      note?: string;
      shopId?: string;
    };

    if (!productShort || typeof productShort !== "string" || productShort.trim() === "") {
      res.status(400).json({ error: "productShort is required" });
      return;
    }

    if (costPrice === undefined || costPrice === null || typeof costPrice !== "number" || costPrice < 0) {
      res.status(400).json({ error: "costPrice must be a non-negative number" });
      return;
    }

    const resolvedShopId = typeof shopId === "string" ? shopId.trim() : "";

    const db = getDb();
    await db.execute({
      sql: `INSERT INTO product_costs (productShort, costPrice, note, userId, shopId)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(productShort, userId, shopId) DO UPDATE SET costPrice = excluded.costPrice, note = excluded.note`,
      args: [productShort.trim(), costPrice, note ?? null, userId, resolvedShopId]
    });

    res.json({ success: true, productShort: productShort.trim(), costPrice, shopId: resolvedShopId });
  } catch (err) {
    console.error("Settings error:", err);
    res.status(500).json({ error: "Failed to save costs" });
  }
});

// DELETE /api/settings/costs/all — xoá toàn bộ giá vốn của user (tất cả shop)
router.delete("/costs/all", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const db = getDb();
    const rs = await db.execute({
      sql: `DELETE FROM product_costs WHERE userId = ?`,
      args: [userId],
    });

    res.json({ success: true, deleted: rs.rowsAffected });
  } catch (err) {
    console.error("Settings error:", err);
    res.status(500).json({ error: "Failed to reset costs" });
  }
});

// GET /api/settings/periods
router.get("/periods", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const shopId = String(req.query.shopId ?? "").trim() || null;
    const db = getDb();

    let rs;
    if (shopId) {
      rs = await db.execute({
        sql: `SELECT DISTINCT period FROM orders WHERE userId = ? AND shopId = ?
           UNION
           SELECT DISTINCT period FROM transactions WHERE userId = ? AND shopId = ?
           ORDER BY period DESC`,
        args: [userId, shopId, userId, shopId]
      });
    } else {
      rs = await db.execute({
        sql: `SELECT DISTINCT period FROM orders WHERE userId = ?
           UNION
           SELECT DISTINCT period FROM transactions WHERE userId = ?
           ORDER BY period DESC`,
        args: [userId, userId]
      });
    }

    const periods = rs.rows.map((p: any) => String(p.period));
    res.json({ periods });
  } catch (err) {
    console.error("Periods error:", err);
    res.status(500).json({ error: "Failed to fetch periods" });
  }
});

export default router;
