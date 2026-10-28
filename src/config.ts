function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

export const CREDIT = "Made by @moonpie24";

export const config = {
  botToken: required("BOT_TOKEN"),
  /** Public HTTPS base URL. Empty → long polling (local dev). */
  publicUrl: (process.env.PUBLIC_URL ?? "").replace(/\/$/, ""),
  webappShortName: process.env.WEBAPP_SHORT_NAME ?? "app",
  groupChatId: process.env.GROUP_CHAT_ID ? Number(process.env.GROUP_CHAT_ID) : undefined,
  /** The only user who can grant or revoke admin rights. Always an admin. */
  ownerId: Number(required("OWNER_ID")),
  webhookSecret: process.env.WEBHOOK_SECRET ?? "",
  dbPath: process.env.DB_PATH ?? "./data/app.db",
  port: Number(process.env.PORT ?? 8080),
};
