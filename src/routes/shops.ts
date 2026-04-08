import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import { getDb } from "../db.js";

const router = Router();

// GET /api/shops
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const db = getDb();
    const rs = await db.execute({
      sql: `SELECT id, name, createdAt FROM shops WHERE userId = ? ORDER BY createdAt ASC`,
      args: [userId],
    });

    const shops = rs.rows.map((r: any) => ({
      id: String(r.id),
      name: String(r.name),
      createdAt: String(r.createdAt),
    }));

    res.json({ shops });
  } catch (err) {
    console.error("Shops error:", err);
    res.status(500).json({ error: "Failed to fetch shops" });
  }
});

// POST /api/shops
router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { name } = req.body as { name?: string };
    if (!name || typeof name !== "string" || name.trim() === "") {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const db = getDb();
    const id = randomUUID();
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO shops (id, name, userId, createdAt) VALUES (?, ?, ?, ?)`,
      args: [id, name.trim(), userId, now],
    });

    res.json({ shop: { id, name: name.trim(), createdAt: now } });
  } catch (err) {
    console.error("Shops error:", err);
    res.status(500).json({ error: "Failed to create shop" });
  }
});

// PATCH /api/shops/:id
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { id } = req.params;
    const { name } = req.body as { name?: string };
    if (!name || typeof name !== "string" || name.trim() === "") {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const db = getDb();
    await db.execute({
      sql: `UPDATE shops SET name = ? WHERE id = ? AND userId = ?`,
      args: [name.trim(), id, userId],
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Shops error:", err);
    res.status(500).json({ error: "Failed to update shop" });
  }
});

// PATCH /api/shops/:id/unlink — bỏ gán shopId khỏi orders/transactions (giữ nguyên shop)
router.patch("/:id/unlink", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { id } = req.params;
    const db = getDb();

    const [ordersRs, txRs] = await Promise.all([
      db.execute({ sql: `UPDATE orders SET shopId = NULL WHERE shopId = ? AND userId = ?`, args: [id, userId] }),
      db.execute({ sql: `UPDATE transactions SET shopId = NULL WHERE shopId = ? AND userId = ?`, args: [id, userId] }),
    ]);
    await db.execute({ sql: `UPDATE upload_batches SET shopId = NULL WHERE shopId = ? AND userId = ?`, args: [id, userId] });

    res.json({ success: true, ordersUnlinked: ordersRs.rowsAffected, transactionsUnlinked: txRs.rowsAffected });
  } catch (err) {
    console.error("Shops error:", err);
    res.status(500).json({ error: "Failed to unlink shop" });
  }
});

// DELETE /api/shops/:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { id } = req.params;
    const db = getDb();

    // Unlink data associated with this shop (set shopId to NULL)
    await db.batch([
      { sql: `UPDATE orders SET shopId = NULL WHERE shopId = ? AND userId = ?`, args: [id, userId] },
      { sql: `UPDATE transactions SET shopId = NULL WHERE shopId = ? AND userId = ?`, args: [id, userId] },
      { sql: `UPDATE upload_batches SET shopId = NULL WHERE shopId = ? AND userId = ?`, args: [id, userId] },
      { sql: `DELETE FROM shops WHERE id = ? AND userId = ?`, args: [id, userId] },
    ], "write");

    res.json({ success: true });
  } catch (err) {
    console.error("Shops error:", err);
    res.status(500).json({ error: "Failed to delete shop" });
  }
});

export default router;
