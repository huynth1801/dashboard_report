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
    quantity: "totalQuantity",
  };
  const sortField = validSortFields[sortBy] ?? "totalUnits";

  const db = getDb();

  // Group by productShort — include both unitCount and raw quantity
  const products = db
    .prepare(
      `SELECT
        productShort,
        SUM(unitCount) AS totalUnits,
        SUM(quantity) AS totalQuantity,
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
    totalQuantity: number;
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
          SUM(quantity) AS qty,
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
      qty: number;
      revenue: number;
      orders: number;
    }>;

    return { ...product, variants };
  });

  res.json({ period, products: result });
});

// GET /api/products/summary?periods=2026-01,2026-02,2026-03
// Multi-month product aggregation — matches user's Q1 Excel summary
router.get("/summary", (req: Request, res: Response) => {
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
  const allProducts = db
    .prepare(
      `SELECT
        productShort,
        period,
        SUM(unitCount) AS units,
        SUM(quantity) AS qty,
        SUM(revenue) AS revenue,
        COUNT(DISTINCT orderId) AS orders
       FROM orders
       WHERE period IN (${placeholders}) AND isCompleted = 1
       GROUP BY productShort, period
       ORDER BY productShort, period`
    )
    .all(...periods) as Array<{
    productShort: string;
    period: string;
    units: number;
    qty: number;
    revenue: number;
    orders: number;
  }>;

  // Per-period totals
  const periodTotals = db
    .prepare(
      `SELECT
        period,
        SUM(unitCount) AS totalUnits,
        SUM(quantity) AS totalQuantity,
        SUM(revenue) AS totalRevenue,
        COUNT(DISTINCT orderId) AS totalOrders
       FROM orders
       WHERE period IN (${placeholders}) AND isCompleted = 1
       GROUP BY period
       ORDER BY period`
    )
    .all(...periods) as Array<{
    period: string;
    totalUnits: number;
    totalQuantity: number;
    totalRevenue: number;
    totalOrders: number;
  }>;

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
});

export default router;

