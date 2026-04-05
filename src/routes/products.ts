import { Router, Request, Response } from "express";
import { getDb } from "../db.js";

const router = Router();

// GET /api/products?period=YYYY-MM&sortBy=units&limit=20
router.get("/", (req: Request, res: Response) => {
  const period = String(req.query.period ?? "").trim();
  const sortBy = String(req.query.sortBy ?? "units").trim();
  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10) || 20, 100);

  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    res.status(400).json({ error: "period query param required (YYYY-MM)" });
    return;
  }

  const validSortFields: Record<string, string> = {
    units: "totalUnits",
    revenue: "totalRevenue",
    orders: "totalOrders",
  };
  const sortField = validSortFields[sortBy] ?? "totalUnits";

  const db = getDb();

  // Group by productShort
  const products = db
    .prepare(
      `SELECT
        productShort,
        SUM(unitCount) AS totalUnits,
        SUM(revenue) AS totalRevenue,
        COUNT(DISTINCT orderId) AS totalOrders
       FROM orders
       WHERE period = ? AND isCompleted = 1
       GROUP BY productShort
       ORDER BY ${sortField} DESC
       LIMIT ?`
    )
    .all(period, limit) as Array<{
    productShort: string;
    totalUnits: number;
    totalRevenue: number;
    totalOrders: number;
  }>;

  // For each product, get variants breakdown
  const result = products.map((product) => {
    const variants = db
      .prepare(
        `SELECT
          variant,
          productName,
          SUM(unitCount) AS units,
          SUM(revenue) AS revenue,
          COUNT(DISTINCT orderId) AS orders
         FROM orders
         WHERE period = ? AND productShort = ? AND isCompleted = 1
         GROUP BY variant, productName
         ORDER BY units DESC`
      )
      .all(period, product.productShort) as Array<{
      variant: string;
      productName: string;
      units: number;
      revenue: number;
      orders: number;
    }>;

    return { ...product, variants };
  });

  res.json({ period, products: result });
});

export default router;
