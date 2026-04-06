import { Router, Request, Response } from "express";
import { getDb } from "../db.js";

const router = Router();

// GET /api/products?period=YYYY-MM&sortBy=units&limit=20
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const periodParam = String(req.query.period ?? "").trim();
    const sortBy = String(req.query.sortBy ?? "units").trim();
    const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10) || 20, 100);

    if (!periodParam) {
      res.status(400).json({ error: "period query param required" });
      return;
    }

    const periods = periodParam.split(",").map(p => p.trim()).filter(p => /^\d{4}-\d{2}$/.test(p));
    if (periods.length === 0) {
      res.status(400).json({ error: "period query param required (YYYY-MM)" });
      return;
    }

    const validSortFields: Record<string, string> = {
      units: "totalUnits",
      revenue: "totalRevenue",
      orders: "totalOrders",
      quantity: "totalQuantity",
    };
    const sortField = validSortFields[sortBy] ?? "totalUnits";

    const db = getDb();
    const placeholders = periods.map(() => "?").join(",");

    // Group by productShort — include both unitCount and raw quantity
    const rs = await db.execute({
      sql: `SELECT
          productShort,
          SUM(unitCount) AS totalUnits,
          SUM(quantity) AS totalQuantity,
          SUM(revenue) AS totalRevenue,
          COUNT(DISTINCT orderId) AS totalOrders
         FROM orders
         WHERE period IN (${placeholders}) AND userId = ? AND isCompleted = 1
         GROUP BY productShort
         ORDER BY ${sortField} DESC
         LIMIT ?`,
      args: [...periods, userId, limit]
    });

    const products = rs.rows.map((row: any) => ({
      productShort: String(row.productShort),
      totalUnits: Number(row.totalUnits ?? 0),
      totalQuantity: Number(row.totalQuantity ?? 0),
      totalRevenue: Number(row.totalRevenue ?? 0),
      totalOrders: Number(row.totalOrders ?? 0),
      variants: [] as any[]
    }));

    // For each product, get variants breakdown
    for (const product of products) {
      const vRs = await db.execute({
        sql: `SELECT
            variant,
            productName,
            SUM(unitCount) AS units,
            SUM(quantity) AS qty,
            SUM(revenue) AS revenue,
            COUNT(DISTINCT orderId) AS orders
           FROM orders
           WHERE period IN (${placeholders}) AND productShort = ? AND userId = ? AND isCompleted = 1
           GROUP BY variant, productName
           ORDER BY units DESC`,
        args: [...periods, product.productShort, userId]
      });

      product.variants = vRs.rows.map((r: any) => ({
        variant: String(r.variant),
        productName: String(r.productName),
        units: Number(r.units ?? 0),
        qty: Number(r.qty ?? 0),
        revenue: Number(r.revenue ?? 0),
        orders: Number(r.orders ?? 0),
      }));
    }

    res.json({ period: periodParam, products });
  } catch (err) {
    console.error("Products error:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// GET /api/products/summary?periods=2026-01,2026-02,2026-03
router.get("/summary", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const periodsParam = String(req.query.periods ?? "").trim();
    if (!periodsParam) {
      res.status(400).json({ error: "periods query param required (comma-separated YYYY-MM)" });
      return;
    }

    const periods = periodsParam.split(",").map((p) => p.trim()).filter((p) => /^\d{4}-\d{2}$/.test(p));
    if (periods.length === 0) {
      res.status(400).json({ error: "No valid periods provided" });
      return;
    }

    const db = getDb();
    const placeholders = periods.map(() => "?").join(",");

    // Get all products across all selected periods
    const allProductsRs = await db.execute({
      sql: `SELECT
          productShort,
          period,
          SUM(unitCount) AS units,
          SUM(quantity) AS qty,
          SUM(revenue) AS revenue,
          COUNT(DISTINCT orderId) AS orders
         FROM orders
         WHERE period IN (${placeholders}) AND userId = ? AND isCompleted = 1
         GROUP BY productShort, period
         ORDER BY productShort, period`,
      args: [...periods, userId]
    });

    const allProducts = allProductsRs.rows.map((r: any) => ({
      productShort: String(r.productShort),
      period: String(r.period),
      units: Number(r.units ?? 0),
      qty: Number(r.qty ?? 0),
      revenue: Number(r.revenue ?? 0),
      orders: Number(r.orders ?? 0),
    }));

    // Per-period totals
    const periodTotalsRs = await db.execute({
      sql: `SELECT
          period,
          SUM(unitCount) AS totalUnits,
          SUM(quantity) AS totalQuantity,
          SUM(revenue) AS totalRevenue,
          COUNT(DISTINCT orderId) AS totalOrders
         FROM orders
         WHERE period IN (${placeholders}) AND userId = ? AND isCompleted = 1
         GROUP BY period
         ORDER BY period`,
      args: [...periods, userId]
    });

    const periodTotals = periodTotalsRs.rows.map((r: any) => ({
      period: String(r.period),
      totalUnits: Number(r.totalUnits ?? 0),
      totalQuantity: Number(r.totalQuantity ?? 0),
      totalRevenue: Number(r.totalRevenue ?? 0),
      totalOrders: Number(r.totalOrders ?? 0),
    }));

    // Build product map: productShort → { perMonth: { period: units }, total }
    const productMap = new Map<
      string,
      {
        productShort: string;
        perMonth: Record<string, number>;
        perMonthRevenue: Record<string, number>;
        perMonthOrders: Record<string, number>;
        total: number;
        totalRevenue: number;
        totalOrders: number;
      }
    >();

    for (const row of allProducts) {
      if (!productMap.has(row.productShort)) {
        productMap.set(row.productShort, {
          productShort: row.productShort,
          perMonth: {},
          perMonthRevenue: {},
          perMonthOrders: {},
          total: 0,
          totalRevenue: 0,
          totalOrders: 0,
        });
      }
      const entry = productMap.get(row.productShort)!;
      entry.perMonth[row.period] = row.units;
      entry.perMonthRevenue[row.period] = row.revenue;
      entry.perMonthOrders[row.period] = row.orders;
      entry.total += row.units;
      entry.totalRevenue += row.revenue;
      entry.totalOrders += row.orders;
    }

    // Sort by total units descending
    const products = Array.from(productMap.values()).sort((a, b) => b.total - a.total);

    // Build totals
    const totals: Record<string, number> = {};
    const orderCounts: Record<string, number> = {};
    let grandTotalUnits = 0;
    let grandTotalOrders = 0;

    for (const pt of periodTotals) {
      totals[pt.period] = pt.totalUnits;
      orderCounts[pt.period] = pt.totalOrders;
      grandTotalUnits += pt.totalUnits;
      grandTotalOrders += pt.totalOrders;
    }
    totals["total"] = grandTotalUnits;
    orderCounts["total"] = grandTotalOrders;

    res.json({ periods, products, totals, orderCounts });
  } catch (err) {
    console.error("Products summary error:", err);
    res.status(500).json({ error: "Failed to fetch products summary" });
  }
});

export default router;
