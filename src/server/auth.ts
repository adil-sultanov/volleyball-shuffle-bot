import { createHmac, timingSafeEqual } from "node:crypto";
import { createMiddleware } from "hono/factory";
import { isAdmin } from "../bot/admin.js";
import { config } from "../config.js";

const MAX_AGE_SECONDS = 24 * 60 * 60;

export interface WebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

/**
 * Validates Telegram Mini App initData.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateInitData(initData: string, botToken: string, nowSeconds = Date.now() / 1000): WebAppUser | null {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(dataCheckString).digest();
  const given = Buffer.from(hash, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  const authDate = Number(params.get("auth_date"));
  if (!authDate || nowSeconds - authDate > MAX_AGE_SECONDS) return null;

  const user = params.get("user");
  return user ? (JSON.parse(user) as WebAppUser) : null;
}

export type AuthEnv = { Variables: { user: WebAppUser } };

/** Requires `Authorization: tma <initData>` from the owner or a bot admin. */
export function requireAdmin() {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const header = c.req.header("authorization") ?? "";
    const user = header.startsWith("tma ") ? validateInitData(header.slice(4), config.botToken) : null;
    if (!user) return c.json({ error: "Open this page from Telegram." }, 401);
    if (!isAdmin(user.id)) return c.json({ error: "Only admins can use this app." }, 403);
    c.set("user", user);
    await next();
  });
}
