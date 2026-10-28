import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { webhookCallback } from "grammy";
import { Hono } from "hono";
import { ALLOWED_UPDATES, configureBotUi, createBot } from "./bot/index.js";
import { config } from "./config.js";
import { runMigrations } from "./db/index.js";
import { apiRoutes } from "./server/routes.js";

runMigrations();

const bot = createBot();
const app = new Hono();

app.get("/healthz", (c) => c.text("ok"));
app.route("/api", apiRoutes(bot.api));

const webhookPath = `/bot/${config.webhookSecret}`;
if (config.publicUrl) {
  app.post(webhookPath, webhookCallback(bot, "hono"));
}

// Mini app static files, with SPA fallback.
const webappRoot = path.relative(
  process.cwd(),
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../webapp/dist"),
);
app.use("/*", serveStatic({ root: webappRoot }));
app.get("/*", serveStatic({ root: webappRoot, path: "index.html" }));

serve({ fetch: app.fetch, port: config.port }, () => console.log(`HTTP server on :${config.port}`));

await configureBotUi(bot);

if (config.publicUrl) {
  if (!config.webhookSecret) throw new Error("WEBHOOK_SECRET is required in webhook mode");
  await bot.api.setWebhook(config.publicUrl + webhookPath, { allowed_updates: ALLOWED_UPDATES });
  console.log(`Webhook set to ${config.publicUrl}/bot/***`);
} else {
  await bot.api.deleteWebhook();
  void bot.start({ allowed_updates: ALLOWED_UPDATES, onStart: (me) => console.log(`Polling as @${me.username}`) });
}
