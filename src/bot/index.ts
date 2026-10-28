import { Bot } from "grammy";
import { config, CREDIT } from "../config.js";
import { adminTgUserIds } from "../db/repo.js";
import { syncAdminCommands } from "./admin.js";
import { registerCommands } from "./commands.js";
import { registerPollHandlers } from "./pollAnswers.js";

export const ALLOWED_UPDATES = ["message", "callback_query", "poll_answer", "poll", "my_chat_member"] as const;

/** Menu button in private chats opens the mini app; command lists are scoped so the group isn't cluttered. */
export async function configureBotUi(bot: Bot) {
  // Shown on the bot's profile and in an empty chat before /start.
  await bot.api.setMyDescription(
    `Posts an in/out poll in your volleyball group and splits the players into balanced teams by strength.\n\n${CREDIT}`,
  );
  await bot.api.setMyShortDescription(`Balanced volleyball teams from your group's poll. ${CREDIT}`);
  if (config.publicUrl) {
    await bot.api.setChatMenuButton({
      menu_button: { type: "web_app", text: "Players", web_app: { url: config.publicUrl } },
    });
  }
  await bot.api.setMyCommands(
    [
      { command: "start", description: "How this bot works" },
      { command: "app", description: "Open the admin panel" },
    ],
    { scope: { type: "all_private_chats" } },
  );
  await bot.api.setMyCommands([], { scope: { type: "all_group_chats" } });
  // Admin commands are shown per user (owner + admins), not to Telegram group admins.
  await bot.api.deleteMyCommands({ scope: { type: "all_chat_administrators" } });
  for (const userId of new Set([config.ownerId, ...adminTgUserIds()])) {
    await syncAdminCommands(bot.api, userId, true);
  }
}

export function createBot() {
  const bot = new Bot(config.botToken);
  registerPollHandlers(bot);
  registerCommands(bot);
  bot.catch((err) => console.error(`Error handling update ${err.ctx.update.update_id}:`, err.error));
  return bot;
}
