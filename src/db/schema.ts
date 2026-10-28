import { sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

const now = sql`(unixepoch())`;

export const players = sqliteTable("players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Null for guests without a Telegram account. */
  tgUserId: integer("tg_user_id").unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  username: text("username"),
  /** Admin override for the name shown in team lists. */
  displayName: text("display_name"),
  strength: integer("strength").notNull().default(3),
  /** False until an admin sets the strength explicitly. */
  rated: integer("rated", { mode: "boolean" }).notNull().default(false),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  /** Granted by the owner. Admins can run /poll and /shuffle and use the mini app. */
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull().default(now),
  updatedAt: integer("updated_at").notNull().default(now),
});

export const chats = sqliteTable("chats", {
  chatId: integer("chat_id").primaryKey(),
  title: text("title"),
  teamSize: integer("team_size").notNull().default(6),
  showTeamSums: integer("show_team_sums", { mode: "boolean" }).notNull().default(false),
});

export const polls = sqliteTable("polls", {
  pollId: text("poll_id").primaryKey(),
  chatId: integer("chat_id").notNull(),
  messageId: integer("message_id").notNull(),
  question: text("question").notNull(),
  closed: integer("closed", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull().default(now),
});

export const pollVotes = sqliteTable(
  "poll_votes",
  {
    pollId: text("poll_id")
      .notNull()
      .references(() => polls.pollId, { onDelete: "cascade" }),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["in", "out"] }).notNull(),
    /** True when an admin added the player from the mini app rather than a real vote. */
    manual: integer("manual", { mode: "boolean" }).notNull().default(false),
    updatedAt: integer("updated_at").notNull().default(now),
  },
  (t) => [primaryKey({ columns: [t.pollId, t.playerId] })],
);

export const shuffles = sqliteTable("shuffles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pollId: text("poll_id").references(() => polls.pollId, { onDelete: "set null" }),
  chatId: integer("chat_id").notNull(),
  teamSize: integer("team_size").notNull(),
  resultJson: text("result_json").notNull(),
  messageId: integer("message_id"),
  createdAt: integer("created_at").notNull().default(now),
});

export type Player = typeof players.$inferSelect;
export type Chat = typeof chats.$inferSelect;
export type Poll = typeof polls.$inferSelect;
