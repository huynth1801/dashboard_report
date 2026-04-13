import { Router, Request, Response } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import { getDb } from "../db.js";
import { parseOrderFile } from "../parsers/order-parser.js";
import { parseBalanceFile } from "../parsers/balance-parser.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.originalname.endsWith(".xlsx") ||
      file.originalname.endsWith(".xls")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only xlsx files are accepted"));
    }
  },
});

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// POST /api/upload/orders
router.post(
  "/orders",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const { period: customPeriod } = req.body;
      const { orders, errors, period } = parseOrderFile(req.file.buffer, customPeriod);
      const db = getDb();
      const batchId = randomUUID();
      const now = new Date().toISOString();
      const shopId = typeof req.body?.shopId === "string" && req.body.shopId.trim() ? req.body.shopId.trim() : null;

      const sql = `
        INSERT INTO orders (orderId, orderDate, status, isCompleted, productName, productShort, sku, variant, quantity, unitCount, revenue, period, userId, shopId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(orderId) DO UPDATE SET
          orderDate = excluded.orderDate,
          status = excluded.status,
          isCompleted = excluded.isCompleted,
          productName = excluded.productName,
          productShort = excluded.productShort,
          sku = excluded.sku,
          variant = excluded.variant,
          quantity = excluded.quantity,
          unitCount = excluded.unitCount,
          revenue = excluded.revenue,
          period = excluded.period,
          userId = excluded.userId,
          shopId = excluded.shopId
      `;

      const chunks = chunkArray(orders, 500);

      // We use batches via db.batch()
      for (const chunk of chunks) {
        const smts = chunk.map(order => ({
          sql,
          args: [
            order.orderId,
            order.orderDate,
            order.status,
            order.isCompleted ? 1 : 0,
            order.productName,
            order.productShort,
            order.sku ?? null,
            order.variant,
            order.quantity,
            order.unitCount,
            order.revenue,
            order.period,
            userId,
            shopId,
          ]
        }));
        await db.batch(smts, "write");
      }

      await db.execute({
        sql: `INSERT INTO upload_batches (id, type, period, rowsImported, createdAt, userId, shopId) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [batchId, "orders", period, orders.length, now, userId, shopId]
      });

      res.json({
        batchId,
        period,
        rowsImported: orders.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (err) {
      console.error("Upload error:", err);
      const message = err instanceof Error ? err.message : "Parse error";
      res.status(422).json({ error: message });
    }
  }
);

// POST /api/upload/balance
router.post(
  "/balance",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const { period: customPeriod } = req.body;
      const { transactions, errors, period } = parseBalanceFile(req.file.buffer, customPeriod);
      const db = getDb();
      const batchId = randomUUID();
      const now = new Date().toISOString();
      const shopId = typeof req.body?.shopId === "string" && req.body.shopId.trim() ? req.body.shopId.trim() : null;

      const sql = `
        INSERT INTO transactions (id, date, type, typeRaw, detail, orderId, amount, period, userId, shopId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          date = excluded.date,
          type = excluded.type,
          typeRaw = excluded.typeRaw,
          detail = excluded.detail,
          orderId = excluded.orderId,
          amount = excluded.amount,
          period = excluded.period,
          userId = excluded.userId,
          shopId = excluded.shopId
      `;

      const chunks = chunkArray(transactions, 500);

      for (const chunk of chunks) {
        const smts = chunk.map(tx => ({
          sql,
          args: [
            tx.id,
            tx.date,
            tx.type,
            tx.typeRaw,
            tx.detail ?? null,
            tx.orderId ?? null,
            tx.amount,
            tx.period,
            userId,
            shopId,
          ]
        }));
        await db.batch(smts, "write");
      }

      await db.execute({
        sql: `INSERT INTO upload_batches (id, type, period, rowsImported, createdAt, userId, shopId) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [batchId, "balance", period, transactions.length, now, userId, shopId]
      });

      res.json({
        batchId,
        period,
        rowsImported: transactions.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (err) {
      console.error("Upload error:", err);
      const message = err instanceof Error ? err.message : "Parse error";
      res.status(422).json({ error: message });
    }
  }
);

// PATCH /api/upload/assign-shop — gán shopId cho dữ liệu đã upload trước đó
router.patch("/assign-shop", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { period, shopId } = req.body as { period?: string; shopId?: string };

    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      res.status(400).json({ error: "period (YYYY-MM) is required" });
      return;
    }
    if (!shopId || typeof shopId !== "string" || shopId.trim() === "") {
      res.status(400).json({ error: "shopId is required" });
      return;
    }

    const db = getDb();

    // Verify shop belongs to this user
    const shopRs = await db.execute({
      sql: `SELECT id FROM shops WHERE id = ? AND userId = ?`,
      args: [shopId.trim(), userId],
    });
    if (shopRs.rows.length === 0) {
      res.status(404).json({ error: "Shop not found" });
      return;
    }

    const [ordersRs, txRs] = await Promise.all([
      db.execute({
        sql: `UPDATE orders SET shopId = ? WHERE period = ? AND userId = ?`,
        args: [shopId.trim(), period, userId],
      }),
      db.execute({
        sql: `UPDATE transactions SET shopId = ? WHERE period = ? AND userId = ?`,
        args: [shopId.trim(), period, userId],
      }),
    ]);

    res.json({
      success: true,
      ordersUpdated: ordersRs.rowsAffected,
      transactionsUpdated: txRs.rowsAffected,
    });
  } catch (err) {
    console.error("Assign shop error:", err);
    res.status(500).json({ error: "Failed to assign shop" });
  }
});

export default router;
