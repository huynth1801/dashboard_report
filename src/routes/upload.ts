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
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    try {
      const { orders, errors, period } = parseOrderFile(req.file.buffer);
      const db = getDb();
      const batchId = randomUUID();
      const now = new Date().toISOString();

      const sql = `
        INSERT INTO orders (orderId, orderDate, status, isCompleted, productName, productShort, sku, variant, quantity, unitCount, revenue, period)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          period = excluded.period
      `;

      const chunks = chunkArray(orders, 500);

      // We use transactions via db.transaction() or db.batch(). @libsql/client provides .batch()
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
            order.period
          ]
        }));
        await db.batch(smts, "write");
      }

      await db.execute({
        sql: `INSERT INTO upload_batches (id, type, period, rowsImported, createdAt) VALUES (?, ?, ?, ?, ?)`,
        args: [batchId, "orders", period, orders.length, now]
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
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    try {
      const { transactions, errors, period } = parseBalanceFile(req.file.buffer);
      const db = getDb();
      const batchId = randomUUID();
      const now = new Date().toISOString();

      const sql = `
        INSERT INTO transactions (id, date, type, typeRaw, detail, orderId, amount, period)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          date = excluded.date,
          type = excluded.type,
          typeRaw = excluded.typeRaw,
          detail = excluded.detail,
          orderId = excluded.orderId,
          amount = excluded.amount,
          period = excluded.period
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
            tx.period
          ]
        }));
        await db.batch(smts, "write");
      }

      await db.execute({
        sql: `INSERT INTO upload_batches (id, type, period, rowsImported, createdAt) VALUES (?, ?, ?, ?, ?)`,
        args: [batchId, "balance", period, transactions.length, now]
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

export default router;
