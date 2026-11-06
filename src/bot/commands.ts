import { InlineKeyboard, type Bot, type Context } from "grammy";
import { config, CREDIT } from "../config.js";
import { pollQuestionFromArg } from "../core/pollQuestion.js";
import { createPoll, ensureChat, getPollByMessage, latestPoll, updateChat, upsertTgPlayer } from "../db/repo.js";
import { isAdmin } from "./admin.js";
import { postShuffle, reshuffle } from "./teams.js";

const isGroup = (ctx: Context) => ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";

/** Replies and returns false unless this is a group. */
async function requireGroup(ctx: Context): Promise<boolean> {
  if (!isGroup(ctx)) {
    await ctx.reply("Use this in the group chat.");
    return false;
  }
  ensureChat(ctx.chat!.id, "title" in ctx.chat! ? ctx.chat.title : undefined);
  return true;
}

/** Replies and returns false unless this is a group and the sender is a bot admin. */
async function requireGroupAdmin(ctx: Context): Promise<boolean> {
  if (!(await requireGroup(ctx))) return false;
  if (!ctx.from || !isAdmin(ctx.from.id)) {
    await ctx.reply("Only admins can do that.", { reply_parameters: { message_id: ctx.msg!.message_id } });
    return false;
  }
  return true;
}

/** `arg` is empty, a time like "8pm" (added to the default question), or a custom question. */
async function sendPoll(ctx: Context, arg = "") {
  const q = pollQuestionFromArg(arg, new Date(), config.timeZone);
  const msg = await ctx.api.sendPoll(ctx.chat!.id, q, [{ text: "✅ In" }, { text: "❌ Out" }], {
    is_anonymous: false,
  });
  createPoll({ pollId: msg.poll.id, chatId: ctx.chat!.id, messageId: msg.message_id, question: q });
}

/** The number of teams comes from the first number in the text, if any. */
async function shuffleCommand(ctx: Context, text: string) {
  const teamsMatch = text.match(/\b(\d{1,2})\b/);
  const teams = teamsMatch ? Number(teamsMatch[1]) : undefined;
  if (teams !== undefined && teams < 2) return ctx.reply("Number of teams must be at least 2.");

  const chatId = ctx.chat!.id;
  const reply = ctx.msg?.reply_to_message;
  let poll = reply?.poll ? getPollByMessage(chatId, reply.message_id) : latestPoll(chatId);
  if (reply?.poll && !poll) {
    return ctx.reply(
      "I can't see who voted in polls that people post, only in polls I post myself. Run /poll to start one.",
    );
  }
  if (!poll) return ctx.reply("There's no poll yet. Run /poll first.");

  try {
    await postShuffle(ctx.api, { chatId, pollId: poll.pollId, teams, replyTo: ctx.msg?.message_id });
  } catch (err) {
    await ctx.reply(err instanceof Error ? err.message : "Shuffle failed.");
  }
}

/** The public features, in the order people use them. Anyone in the group can do all of this. */
const HELP_LINES = [
  "1. /poll: post the in/out poll. Add a time, like /poll 8pm",
  "2. Vote ✅ In or ❌ Out",
  "3. /shuffle: post balanced teams from the latest poll. Use /shuffle 3 for 3 teams",
  "4. Tap 🔄 Reshuffle under the teams for a new split",
];

function appLink(botUsername: string) {
  return `https://t.me/${botUsername}/${config.webappShortName}`;
}

export function registerCommands(bot: Bot) {
  bot.command("start", async (ctx) => {
    if (isGroup(ctx)) return;
    // Registers the user so the owner can find them in the player list and make them an admin.
    upsertTgPlayer(ctx.from!);
    const keyboard = config.publicUrl
      ? new InlineKeyboard().webApp("Open player database", config.publicUrl)
      : undefined;
    await ctx.reply(
      [
        "Hi! I balance volleyball teams.",
        "",
        "In the group (anyone):",
        ...HELP_LINES,
        "",
        "In the group (admins):",
        "/teamsize N: set the team size",
        "/sums on|off: show or hide team strength totals",
        "",
        "Here in the private chat, open the admin panel with the menu button or /app.",
        "",
        "You can also mention me: \"@" + ctx.me.username + " shuffle 3\".",
        "",
        CREDIT,
      ].join("\n"),
      { reply_markup: keyboard },
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      ["🏐 I make balanced volleyball teams from your group's poll.", "", ...HELP_LINES, "", "Anyone in the group can do this."].join("\n"),
    );
  });

  bot.command("poll", async (ctx) => {
    if (!(await requireGroup(ctx))) return;
    await sendPoll(ctx, ctx.match);
  });

  bot.command("shuffle", async (ctx) => {
    if (!(await requireGroup(ctx))) return;
    await shuffleCommand(ctx, ctx.match);
  });

  bot.command("teamsize", async (ctx) => {
    if (!(await requireGroupAdmin(ctx))) return;
    const n = Number(ctx.match.trim());
    if (!Number.isInteger(n) || n < 1 || n > 20) return ctx.reply("Usage: /teamsize 6");
    updateChat(ctx.chat.id, { teamSize: n });
    await ctx.reply(`Default team size is now ${n}.`);
  });

  bot.command("sums", async (ctx) => {
    if (!(await requireGroupAdmin(ctx))) return;
    const arg = ctx.match.trim().toLowerCase();
    if (arg !== "on" && arg !== "off") return ctx.reply("Usage: /sums on or /sums off");
    updateChat(ctx.chat.id, { showTeamSums: arg === "on" });
    await ctx.reply(`Team strength totals are now ${arg === "on" ? "shown" : "hidden"}.`);
  });

  // Private chat only, so opening the app never posts anything in the group.
  bot.command("app", async (ctx) => {
    if (isGroup(ctx)) return;
    await ctx.reply("Admin panel: players and strength levels.", {
      reply_markup: config.publicUrl
        ? new InlineKeyboard().webApp("Open mini app", config.publicUrl)
        : new InlineKeyboard().url("Open mini app", appLink(ctx.me.username)),
    });
  });

  // "@bot shuffle 3", "@bot poll", or "@bot" alone. Anything else is someone just talking about the bot.
  bot.on("message:entities:mention", async (ctx, next) => {
    const me = `@${ctx.me.username}`.toLowerCase();
    if (!ctx.entities("mention").some((e) => e.text.toLowerCase() === me)) return next();
    const rest = ctx.msg.text.replace(new RegExp(me, "ig"), "").trim();
    const wantsPoll = /^poll\b/i.test(rest);
    if (!wantsPoll && rest !== "" && !/^shuffle\b/i.test(rest)) return next();
    if (!(await requireGroup(ctx))) return;
    if (wantsPoll) return sendPoll(ctx, rest.replace(/^poll\b/i, ""));
    await shuffleCommand(ctx, rest);
  });

  bot.callbackQuery(/^rs:(\d+)$/, async (ctx) => {
    try {
      await reshuffle(ctx.api, Number(ctx.match[1]));
      await ctx.answerCallbackQuery({ text: "Reshuffled" });
    } catch (err) {
      const text = err instanceof Error ? err.message : "Reshuffle failed.";
      await ctx.answerCallbackQuery({ text: text.slice(0, 200), show_alert: true });
    }
  });

  // Log the chat id when the bot joins a group, to make GROUP_CHAT_ID easy to find.
  bot.on("my_chat_member", (ctx) => {
    const status = ctx.myChatMember.new_chat_member.status;
    if (status === "member" || status === "administrator") {
      const title = "title" in ctx.chat ? ctx.chat.title : undefined;
      ensureChat(ctx.chat.id, title);
      console.log(`Added to chat "${title}" (id ${ctx.chat.id})`);
    }
  });
}
