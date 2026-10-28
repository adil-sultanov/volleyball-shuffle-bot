import type { Api } from "grammy";
import { config } from "../config.js";
import { isAdminUser } from "../db/repo.js";

export const GROUP_ADMIN_COMMANDS = [
  { command: "poll", description: "Post the in/out poll" },
  { command: "shuffle", description: "Post balanced teams from the latest poll" },
  { command: "teamsize", description: "Set the default team size" },
  { command: "sums", description: "Show or hide team totals (on|off)" },
];

export const isOwner = (userId: number) => userId === config.ownerId;

/** The owner, or a player the owner made an admin. Telegram group roles don't matter. */
export function isAdmin(userId: number): boolean {
  return isOwner(userId) || isAdminUser(userId);
}

/** Shows the admin commands in the group's "/" menu for this user only, or removes them. */
export async function syncAdminCommands(api: Api, userId: number, admin: boolean) {
  if (config.groupChatId === undefined) return;
  const scope = { type: "chat_member", chat_id: config.groupChatId, user_id: userId } as const;
  try {
    if (admin) await api.setMyCommands(GROUP_ADMIN_COMMANDS, { scope });
    else await api.deleteMyCommands({ scope });
  } catch (err) {
    // Fails if the user isn't in the group yet; the commands still work when typed.
    console.warn(`Could not update command menu for user ${userId}:`, err instanceof Error ? err.message : err);
  }
}
