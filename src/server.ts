import { createApp } from "./app.js";

const PORT = process.env.PORT ?? 3001;
const app = createApp();

app.listen(PORT, () => {
  console.log(`Shopee Dashboard API running on http://localhost:${PORT}`);
});
