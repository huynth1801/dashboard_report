import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import multer from "multer";
import { runMigrations } from "./db.js";
import uploadRouter from "./routes/upload.js";
import dashboardRouter from "./routes/dashboard.js";
import productsRouter from "./routes/products.js";
import financeRouter from "./routes/finance.js";
import settingsRouter from "./routes/settings.js";
import { requireAuth } from "./middleware/auth.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Migrations will be run async in server.ts

  // Routes
  app.use("/api/upload", requireAuth, uploadRouter);
  app.use("/api/dashboard", requireAuth, dashboardRouter);
  app.use("/api/products", requireAuth, productsRouter);
  app.use("/api/finance", requireAuth, financeRouter);
  app.use("/api/settings", requireAuth, settingsRouter);

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // JSON error handler — catches multer errors and any unhandled route errors
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof multer.MulterError) {
      const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      res.status(status).json({ error: err.message });
      return;
    }
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  });

  return app;
}
