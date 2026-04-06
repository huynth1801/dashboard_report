import { createApp } from "../src/app.js";
import { runMigrations } from "../src/db.js";
import { Request, Response } from "express";

// Create the express app
const app = createApp();

let dbInitialized = false;

// Export as a Vercel serverless function
export default async function handler(req: Request, res: Response) {
  if (!dbInitialized) {
    try {
      await runMigrations();
      dbInitialized = true;
    } catch (e) {
      console.error("Migration failed on serverless start:", e);
      // We log but continue, allowing the request to try
    }
  }

  // Delegate the request to Express
  return app(req, res);
}
