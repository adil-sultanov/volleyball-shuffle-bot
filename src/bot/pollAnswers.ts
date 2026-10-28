import type { Bot } from "grammy";
import { closePoll, getPoll, setVote, upsertTgPlayer } from "../db/repo.js";

/** Option order of the polls the bot sends: 0 = in, 1 = out. */
const STATUS_BY_OPTION = ["in", "out"] as const;

export function registerPollHandlers(bot: Bot) {
  bot.on("poll_answer", (ctx) => {
    const answer = ctx.pollAnswer;
    if (!answer.user || !getPoll(answer.poll_id)) return; // not our poll, or an anonymous channel vote
    const player = upsertTgPlayer(answer.user);
    const option = answer.option_ids[0];
    setVote(answer.poll_id, player.id, option === undefined ? null : STATUS_BY_OPTION[option] ?? null);
  });

  bot.on("poll", (ctx) => {
    if (ctx.poll.is_closed) closePoll(ctx.poll.id);
  });
}
