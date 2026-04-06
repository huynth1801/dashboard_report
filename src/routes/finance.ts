import { Router, Request, Response } from "express";
import { getDb } from "../db.js";

const router = Router();

// GET /api/finance?period=YYYY-MM
router.get("/", async (req: Request, res: Response) => {
  try {
    const periodParam = String(req.query.period ?? "").trim();
    if (!periodParam) {
      res.status(400).json({ error: "period query param required" });
      return;
    }

    const periods = periodParam.split(",").map(p => p.trim()).filter(p => /^\d{4}-\d{2}$/.test(p));
    if (periods.length === 0) {
      res.status(400).json({ error: "period query param required (YYYY-MM)" });
      return;
    }

    const db = getDb();
    const placeholders = periods.map(() => "?").join(",");

    // Transactions for the period
    const txRs = await db.execute({
      sql: `SELECT id, date, type, typeRaw, detail, orderId, amount
         FROM transactions
         WHERE period IN (${placeholders})
         ORDER BY date DESC`,
      args: periods
    });

    const transactions = txRs.rows.map((r: any) => ({
      id: String(r.id),
      date: String(r.date),
      type: String(r.type),
      typeRaw: String(r.typeRaw),
      detail: String(r.detail),
      orderId: String(r.orderId),
      amount: Number(r.amount ?? 0),
    }));

    // Summary by type for current period
    const summaryRs = await db.execute({
      sql: `SELECT type, SUM(amount) AS total, COUNT(*) AS count
         FROM transactions
         WHERE period IN (${placeholders})
         GROUP BY type
         ORDER BY ABS(SUM(amount)) DESC`,
      args: periods
    });

    const summary = summaryRs.rows.map((r: any) => ({
      type: String(r.type),
      total: Number(r.total ?? 0),
      count: Number(r.count ?? 0),
    }));

    // 3-month comparison
    const comparison: any[] = [];
    if (periods.length === 1) {
      const [y, m] = periods[0].split("-").map(Number);
      const prevPeriods = [0, -1, -2].map((offset) => {
        const d = new Date(y, m - 1 + offset, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      });

      for (const p of prevPeriods) {
        const rs = await db.execute({
          sql: `SELECT
              SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS income,
              SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS expense,
              SUM(amount) AS net
             FROM transactions WHERE period = ?`,
          args: [p]
        });
        const row = rs.rows[0];
        comparison.push({
          period: p,
          income: Number(row?.income ?? 0),
          expense: Number(row?.expense ?? 0),
          net: Number(row?.net ?? 0),
        });
      }
    }

    res.json({ period: periodParam, transactions, summary, comparison });
  } catch (err) {
    console.error("Finance error:", err);
    res.status(500).json({ error: "Failed to fetch finance dat" });
  }
});

export default router;
