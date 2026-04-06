import { createApp } from "./app.js";
import { runMigrations } from "./db.js";

const PORT = process.env.PORT ?? 3001;

async function startServer() {
  await runMigrations();
  const app = createApp();

  app.listen(PORT, () => {
    console.log(`Shopee Dashboard API running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
