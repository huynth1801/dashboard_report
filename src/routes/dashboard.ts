import { Router, Request, Response } from "express";
import { getDb } from "../db.js";

const router = Router();

// GET /api/dashboard?period=YYYY-MM or YYYY-MM,YYYY-MM
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const periodParam = String(req.query.period ?? "").trim().replace(/\//g, "-");
    if (!periodParam) {
      res.status(400).json({ error: "period query param required" });
      return;
    }

    const periods = periodParam.split(",").map(p => p.trim()).filter(p => /^\d{4}-\d{2}(-\d{2})?$/.test(p));
    if (periods.length === 0) {
      res.status(400).json({ error: "period query param required (YYYY-MM or YYYY-MM-DD)" });
      return;
    }

    const db = getDb();
    const placeholders = periods.map(() => "?").join(",");

    // --- KPIs ---
    const orderStatsRs = await db.execute({
      sql: `SELECT
          COUNT(DISTINCT o.orderId) AS totalOrders,
          SUM(o.revenue) AS totalRevenue,
          SUM(o.unitCount) AS totalUnits,
          SUM(o.quantity) AS totalQuantity,
          SUM(o.unitCount * IFNULL(c.costPrice, 0)) AS totalCost
         FROM orders o
         LEFT JOIN settings_costs c ON o.productShort = c.productShort AND o.userId = c.userId
         WHERE o.period IN (${placeholders}) AND o.userId = ? AND o.isCompleted = 1`,
      args: [...periods, userId],
    });

    const orderStatsRow = orderStatsRs.rows[0] as unknown as {
      totalOrders: number;
      totalRevenue: number | null;
      totalUnits: number | null;
      totalQuantity: number | null;
      totalCost: number | null;
    };

    const orderStats = {
      totalOrders: Number(orderStatsRow?.totalOrders ?? 0),
      totalRevenue: Number(orderStatsRow?.totalRevenue ?? 0),
      totalUnits: Number(orderStatsRow?.totalUnits ?? 0),
      totalQuantity: Number(orderStatsRow?.totalQuantity ?? 0),
      totalCost: Number(orderStatsRow?.totalCost ?? 0),
    };

    const avgOrderValue =
      orderStats.totalOrders > 0
        ? orderStats.totalRevenue / orderStats.totalOrders
        : 0;

    // Transaction stats — matching user's Excel breakdown
    const txStatsRs = await db.execute({
      sql: `SELECT
          SUM(CASE WHEN type IN ('service_fee','commission_fee') THEN amount ELSE 0 END) AS totalFees,
          SUM(CASE WHEN type = 'shipping_rebate' THEN amount ELSE 0 END) AS shippingAdj,
          SUM(CASE WHEN type = 'return_refund' THEN amount ELSE 0 END) AS totalRefunds,
          SUM(CASE WHEN type = 'voucher' THEN amount ELSE 0 END) AS totalVouchers
         FROM transactions
         WHERE period IN (${placeholders}) AND userId = ?`,
      args: [...periods, userId],
    });

    const txRow = txStatsRs.rows[0] as unknown as {
      totalFees: number | null;
      shippingAdj: number | null;
      totalRefunds: number | null;
      totalVouchers: number | null;
    };

    const txStats = {
      totalFees: Number(txRow?.totalFees ?? 0),
      shippingAdj: Number(txRow?.shippingAdj ?? 0),
      totalRefunds: Number(txRow?.totalRefunds ?? 0),
      totalVouchers: Number(txRow?.totalVouchers ?? 0),
    };

    // Revenue calculation — matching user's Excel:
    // DOANH THU RÒNG = Doanh thu đơn hàng - |Phí quảng cáo/Shopee| - |Điều chỉnh phí ship|
    const totalRevenue = orderStats.totalRevenue;
    const totalFees = Math.abs(txStats.totalFees);
    const shippingAdj = Math.abs(txStats.shippingAdj);
    const totalRefunds = Math.abs(txStats.totalRefunds);
    const totalVouchers = Math.abs(txStats.totalVouchers);
    const netRevenue = totalRevenue - totalFees - shippingAdj;
    const totalCost = orderStats.totalCost;
    const netProfit = netRevenue - totalCost;

    // Days in period
    let totalDays = 0;
    for (const p of periods) {
      const [y, m] = p.split("-").map(Number);
      totalDays += new Date(y, m, 0).getDate();
    }
    const avgDailyRevenue = totalDays > 0 ? totalRevenue / totalDays : 0;

    const kpis = {
      totalRevenue,
      totalOrders: orderStats.totalOrders,
      totalUnits: orderStats.totalUnits,
      totalQuantity: orderStats.totalQuantity,
      avgOrderValue,
      netRevenue,
      totalFees,
      shippingAdj,
      totalRefunds,
      totalVouchers,
      avgDailyRevenue,
      totalCost,
      netProfit,
    };

    // --- Daily series ---
    const dailyRs = await db.execute({
      sql: `SELECT
          SUBSTR(orderDate, 1, 10) AS day,
          COUNT(DISTINCT orderId) AS orders,
          SUM(revenue) AS revenue,
          SUM(unitCount) AS units,
          SUM(quantity) AS quantity
         FROM orders
         WHERE period IN (${placeholders}) AND userId = ? AND isCompleted = 1
         GROUP BY day
         ORDER BY day ASC`,
      args: [...periods, userId],
    });

    const dailySeries = dailyRs.rows.map((r: any) => ({
      day: String(r.day),
      orders: Number(r.orders ?? 0),
      revenue: Number(r.revenue ?? 0),
      units: Number(r.units ?? 0),
      quantity: Number(r.quantity ?? 0),
    }));

    // --- Waterfall data ---
    const waterfall = [
      { label: "Doanh thu đơn hàng", value: totalRevenue, type: "income" },
      { label: "Phí QC/Shopee", value: -totalFees, type: "expense" },
      { label: "Đ/c phí ship", value: -shippingAdj, type: "expense" },
      { label: "Doanh thu ròng", value: netRevenue, type: "total" },
      { label: "Giá vốn hàng bán", value: -totalCost, type: "expense" },
      { label: "LỢI NHUẬN THỰC", value: netProfit, type: "total" },
    ];

    // Previous period revenue for comparison
    const prevRevenue = [];
    if (periods.length === 1) {
      const [y, m] = periods[0].split("-").map(Number);
      const prevPeriods = [-1, -2, -3].map((offset) => {
        const d = new Date(y, m - 1 + offset, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      });
      for (const p of prevPeriods) {
        const rs = await db.execute({
          sql: `SELECT SUM(revenue) AS revenue FROM orders WHERE period = ? AND userId = ? AND isCompleted = 1`,
          args: [p, userId]
        });
        const rev = Number(rs.rows[0]?.revenue ?? 0);
        prevRevenue.push({ period: p, revenue: rev });
      }
    }

    res.json({ period: periodParam, kpis, dailySeries, waterfall, prevRevenue });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

export default router;
