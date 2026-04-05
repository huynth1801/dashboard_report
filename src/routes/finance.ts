import { Router, Request, Response } from "express";
import { getDb } from "../db.js";

const router = Router();

// GET /api/finance?period=YYYY-MM
router.get("/", (req: Request, res: Response) => {
  const period = String(req.query.period ?? "").trim();
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    res.status(400).json({ error: "period query param required (YYYY-MM)" });
    return;
  }

  const db = getDb();

  // Transactions for the period
  const transactions = db
    .prepare(
      `SELECT id, date, type, typeRaw, detail, orderId, amount
       FROM transactions
       WHERE period = ?
       ORDER BY date DESC`
    )
    .all(period) as Array<{
    id: string;
    date: string;
    type: string;
    typeRaw: string;
    detail: string;
    orderId: string;
    amount: number;
  }>;

  // Summary by type for current period
  const summary = db
    .prepare(
      `SELECT type, SUM(amount) AS total, COUNT(*) AS count
       FROM transactions
       WHERE period = ?
       GROUP BY type
       ORDER BY ABS(SUM(amount)) DESC`
    )
    .all(period) as Array<{ type: string; total: number; count: number }>;

  // 3-month comparison
  const [y, m] = period.split("-").map(Number);
  const comparison = [0, -1, -2].map((offset) => {
    const d = new Date(y, m - 1 + offset, 1);
    const p = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const row = db
      .prepare(
        `SELECT
          SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS income,
          SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS expense,
          SUM(amount) AS net
         FROM transactions WHERE period = ?`
      )
      .get(p) as { income: number; expense: number; net: number };
    return {
      period: p,
      income: row?.income ?? 0,
      expense: row?.expense ?? 0,
      net: row?.net ?? 0,
    };
  });

  res.json({ period, transactions, summary, comparison });
});

export default router;
