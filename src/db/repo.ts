import { and, desc, eq, sql } from "drizzle-orm";
import { formatTeams } from "../core/format.js";
import { shuffleTeams, type ShuffleResult } from "../core/shuffle.js";
import { db } from "./index.js";
import { chats, players, pollVotes, polls, shuffles, type Chat, type Player } from "./schema.js";

export interface TgUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

export function playerName(p: Player): string {
  return p.displayName || (p.lastName ? `${p.firstName} ${p.lastName[0]}.` : p.firstName);
}

export function upsertTgPlayer(user: TgUser): Player {
  return db
    .insert(players)
    .values({ tgUserId: user.id, firstName: user.first_name, lastName: user.last_name, username: user.username })
    .onConflictDoUpdate({
      target: players.tgUserId,
      set: {
        firstName: user.first_name,
        lastName: user.last_name ?? null,
        username: user.username ?? null,
        updatedAt: sql`(unixepoch())`,
      },
    })
    .returning()
    .get();
}

export function ensureChat(chatId: number, title?: string): Chat {
  db.insert(chats)
    .values({ chatId, title })
    .onConflictDoUpdate({ target: chats.chatId, set: title ? { title } : { chatId } })
    .run();
  return db.select().from(chats).where(eq(chats.chatId, chatId)).get()!;
}

export function updateChat(chatId: number, patch: Partial<Pick<Chat, "teamSize" | "showTeamSums">>) {
  ensureChat(chatId);
  db.update(chats).set(patch).where(eq(chats.chatId, chatId)).run();
}

export function createPoll(p: { pollId: string; chatId: number; messageId: number; question: string }) {
  db.insert(polls).values(p).run();
}

export function getPoll(pollId: string) {
  return db.select().from(polls).where(eq(polls.pollId, pollId)).get();
}

export function getPollByMessage(chatId: number, messageId: number) {
  return db
    .select()
    .from(polls)
    .where(and(eq(polls.chatId, chatId), eq(polls.messageId, messageId)))
    .get();
}

export function closePoll(pollId: string) {
  db.update(polls).set({ closed: true }).where(eq(polls.pollId, pollId)).run();
}

export function latestPoll(chatId: number) {
  return db.select().from(polls).where(eq(polls.chatId, chatId)).orderBy(desc(polls.createdAt), desc(sql`rowid`)).get();
}

export function setVote(pollId: string, playerId: number, status: "in" | "out" | null, manual = false) {
  if (status === null) {
    db.delete(pollVotes)
      .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.playerId, playerId)))
      .run();
    return;
  }
  db.insert(pollVotes)
    .values({ pollId, playerId, status, manual })
    .onConflictDoUpdate({
      target: [pollVotes.pollId, pollVotes.playerId],
      set: { status, manual, updatedAt: sql`(unixepoch())` },
    })
    .run();
}

export function pollVoters(pollId: string) {
  return db
    .select({ player: players, status: pollVotes.status, manual: pollVotes.manual })
    .from(pollVotes)
    .innerJoin(players, eq(players.id, pollVotes.playerId))
    .where(eq(pollVotes.pollId, pollId))
    .orderBy(players.firstName)
    .all();
}

export function attendees(pollId: string): Player[] {
  return pollVoters(pollId)
    .filter((v) => v.status === "in")
    .map((v) => v.player);
}

export interface ShuffleOutcome {
  result: ShuffleResult;
  text: string;
}

/** Runs the shuffle for a poll's "in" list. Throws a user-facing Error if it can't. */
export function shuffleForPoll(pollId: string, chatId: number, teamSize?: number): ShuffleOutcome {
  const chat = ensureChat(chatId);
  const size = teamSize ?? chat.teamSize;
  const going = attendees(pollId);
  if (going.length < 2) throw new Error(`Only ${going.length} player(s) are in. Need at least 2.`);
  const result = shuffleTeams(
    going.map((p) => ({ id: p.id, name: playerName(p), strength: p.strength })),
    size,
  );
  return { result, text: formatTeams(result, { showSums: chat.showTeamSums }) };
}

export function saveShuffle(s: { pollId: string; chatId: number; result: ShuffleResult; messageId?: number }) {
  return db
    .insert(shuffles)
    .values({
      pollId: s.pollId,
      chatId: s.chatId,
      teamSize: s.result.teamSize,
      resultJson: JSON.stringify(s.result),
      messageId: s.messageId,
    })
    .returning()
    .get();
}

export function getShuffle(id: number) {
  return db.select().from(shuffles).where(eq(shuffles.id, id)).get();
}

export function updateShuffle(id: number, result: ShuffleResult, messageId?: number) {
  db.update(shuffles)
    .set({ resultJson: JSON.stringify(result), ...(messageId ? { messageId } : {}) })
    .where(eq(shuffles.id, id))
    .run();
}

export function listPlayers(): Player[] {
  return db.select().from(players).orderBy(players.firstName).all();
}

export function getPlayer(id: number) {
  return db.select().from(players).where(eq(players.id, id)).get();
}

export function createGuest(name: string, strength: number): Player {
  return db.insert(players).values({ firstName: name, strength, rated: true }).returning().get();
}

export function isAdminUser(tgUserId: number): boolean {
  return Boolean(
    db
      .select({ id: players.id })
      .from(players)
      .where(and(eq(players.tgUserId, tgUserId), eq(players.isAdmin, true)))
      .get(),
  );
}

export function adminTgUserIds(): number[] {
  return db
    .select({ tgUserId: players.tgUserId })
    .from(players)
    .where(eq(players.isAdmin, true))
    .all()
    .flatMap((r) => (r.tgUserId === null ? [] : [r.tgUserId]));
}

export function updatePlayer(
  id: number,
  patch: Partial<Pick<Player, "strength" | "displayName" | "active" | "isAdmin">>,
): Player | undefined {
  return db
    .update(players)
    .set({ ...patch, ...(patch.strength !== undefined ? { rated: true } : {}), updatedAt: sql`(unixepoch())` })
    .where(eq(players.id, id))
    .returning()
    .get();
}

export function listShuffles(chatId: number, limit = 20) {
  return db.select().from(shuffles).where(eq(shuffles.chatId, chatId)).orderBy(desc(shuffles.id)).limit(limit).all();
}
