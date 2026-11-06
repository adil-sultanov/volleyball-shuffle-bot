import { InlineKeyboard, type Api } from "grammy";
import type { ShuffleResult } from "../core/shuffle.js";
import { getShuffle, saveShuffle, shuffleForPoll, updateShuffle, type ShuffleOutcome } from "../db/repo.js";

const reshuffleKeyboard = (shuffleId: number) => new InlineKeyboard().text("🔄 Reshuffle", `rs:${shuffleId}`);

/** Shuffles the poll's "in" list and posts the teams to the chat. Shared by the bot and the mini app. */
export async function postShuffle(
  api: Api,
  opts: { chatId: number; pollId: string; teamSize?: number; teams?: number; replyTo?: number },
): Promise<ShuffleOutcome & { shuffleId: number }> {
  const outcome = shuffleForPoll(opts.pollId, opts.chatId, opts.teamSize, opts.teams);
  const row = saveShuffle({ pollId: opts.pollId, chatId: opts.chatId, result: outcome.result });
  const msg = await api.sendMessage(opts.chatId, outcome.text, {
    parse_mode: "HTML",
    reply_markup: reshuffleKeyboard(row.id),
    ...(opts.replyTo ? { reply_parameters: { message_id: opts.replyTo, allow_sending_without_reply: true } } : {}),
  });
  updateShuffle(row.id, outcome.result, msg.message_id);
  return { ...outcome, shuffleId: row.id };
}

/** Re-runs a saved shuffle with the current "in" list and edits its message in place. */
export async function reshuffle(api: Api, shuffleId: number): Promise<void> {
  const prev = getShuffle(shuffleId);
  if (!prev?.pollId || !prev.messageId) throw new Error("This shuffle can no longer be updated.");
  const { requestedTeams } = JSON.parse(prev.resultJson) as ShuffleResult;
  const outcome = shuffleForPoll(prev.pollId, prev.chatId, prev.teamSize, requestedTeams);
  await api.editMessageText(prev.chatId, prev.messageId, outcome.text, {
    parse_mode: "HTML",
    reply_markup: reshuffleKeyboard(shuffleId),
  });
  updateShuffle(shuffleId, outcome.result);
}
