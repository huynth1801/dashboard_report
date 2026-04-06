import { Router, Request, Response } from "express";
import { getDb } from "../db.js";

const router = Router();

// GET /api/dashboard?period=YYYY-MM
router.get("/", (req: Request, res: Response) => {
  const period = String(req.query.period ?? "").trim();
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    res.status(400).json({ error: "period query param required (YYYY-MM)" });
    return;
  }

  const db = getDb();

  // --- KPIs ---
  const orderStats = db
    .prepare(
      `SELECT
        COUNT(DISTINCT orderId) AS totalOrders,
        SUM(revenue) AS totalRevenue,
        SUM(unitCount) AS totalUnits,
        SUM(quantity) AS totalQuantity
       FROM orders
       WHERE period = ? AND isCompleted = 1`
    )
    .get(period) as {
    totalOrders: number;
    totalRevenue: number;
    totalUnits: number;
    totalQuantity: number;
  };

  const avgOrderValue =
    orderStats.totalOrders > 0
      ? (orderStats.totalRevenue ?? 0) / orderStats.totalOrders
      : 0;

  // 3-month previous periods for comparison
  const [y, m] = period.split("-").map(Number);
  const prevPeriods = [-1, -2, -3].map((offset) => {
    const d = new Date(y, m - 1 + offset, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // Transaction stats — matching user's Excel breakdown
  const txStats = db
    .prepare(
      `SELECT
        SUM(CASE WHEN type IN ('service_fee','commission_fee') THEN amount ELSE 0 END) AS totalFees,
        SUM(CASE WHEN type = 'shipping_rebate' THEN amount ELSE 0 END) AS shippingAdj,
        SUM(CASE WHEN type = 'return_refund' THEN amount ELSE 0 END) AS totalRefunds,
        SUM(CASE WHEN type = 'voucher' THEN amount ELSE 0 END) AS totalVouchers
       FROM transactions
       WHERE period = ?`
    )
    .get(period) as {
    totalFees: number;
    shippingAdj: number;
    totalRefunds: number;
    totalVouchers: number;
  };

  // Revenue calculation — matching user's Excel:
  // DOANH THU RÒNG = Doanh thu đơn hàng - |Phí quảng cáo/Shopee| - |Điều chỉnh phí ship|
  const totalRevenue = orderStats.totalRevenue ?? 0;
  const totalFees = Math.abs(txStats?.totalFees ?? 0);
  const shippingAdj = Math.abs(txStats?.shippingAdj ?? 0);
  const totalRefunds = Math.abs(txStats?.totalRefunds ?? 0);
  const totalVouchers = Math.abs(txStats?.totalVouchers ?? 0);
  const netRevenue = totalRevenue - totalFees - shippingAdj;

  // Days in period
  const daysInPeriod = new Date(y, m, 0).getDate();
  const avgDailyRevenue = totalRevenue / daysInPeriod;

  const kpis = {
    totalRevenue,
    totalOrders: orderStats.totalOrders ?? 0,
    totalUnits: orderStats.totalUnits ?? 0,
    totalQuantity: orderStats.totalQuantity ?? 0,
    avgOrderValue,
    netRevenue,
    totalFees,
    shippingAdj,
    totalRefunds,
    totalVouchers,
    avgDailyRevenue,
  };

  // --- Daily series ---
  const dailySeries = db
    .prepare(
      `SELECT
        SUBSTR(orderDate, 1, 10) AS day,
        COUNT(DISTINCT orderId) AS orders,
        SUM(revenue) AS revenue,
        SUM(unitCount) AS units,
        SUM(quantity) AS quantity
       FROM orders
       WHERE period = ? AND isCompleted = 1
       GROUP BY day
       ORDER BY day ASC`
    )
    .all(period) as Array<{
    day: string;
    orders: number;
    revenue: number;
    units: number;
    quantity: number;
  }>;

  // --- Waterfall data — matching user's Excel breakdown ---
  const waterfall = [
    { label: "Doanh thu đơn hàng", value: totalRevenue, type: "income" },
    { label: "Phí QC/Shopee", value: -totalFees, type: "expense" },
    { label: "Đ/c phí ship", value: -shippingAdj, type: "expense" },
    { label: "DOANH THU RÒNG", value: netRevenue, type: "total" },
  ];

  // Previous period revenue for comparison
  const prevRevenue = prevPeriods.map((p) => {
    const row = db
      .prepare(
        `SELECT SUM(revenue) AS revenue FROM orders WHERE period = ? AND isCompleted = 1`
      )
      .get(p) as { revenue: number };
    return { period: p, revenue: row?.revenue ?? 0 };
  });

  res.json({ period, kpis, dailySeries, waterfall, prevRevenue });
});

export default router;

