import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    env: { BOT_TOKEN: "test:token", OWNER_ID: "1", DB_PATH: ":memory:" },
  },
});
