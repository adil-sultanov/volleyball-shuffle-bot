import type { Api } from "grammy";
import { Hono } from "hono";
import { isOwner, syncAdminCommands } from "../bot/admin.js";
import { postShuffle } from "../bot/teams.js";
import { config } from "../config.js";
import {
  createGuest,
  ensureChat,
  getPlayer,
  getPoll,
  latestPoll,
  listPlayers,
  listShuffles,
  playerName,
  pollVoters,
  setVote,
  shuffleForPoll,
  updateChat,
  updatePlayer,
} from "../db/repo.js";
import type { Player } from "../db/schema.js";
import { requireAdmin, type AuthEnv } from "./auth.js";

const isStrength = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 5;
const isTeamSize = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 20;

const toDto = (p: Player) => ({ ...p, name: playerName(p) });

export function apiRoutes(api: Api) {
  const app = new Hono<AuthEnv>();
  app.use("*", requireAdmin());

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: err.message }, 400);
  });

  const groupChatId = () => {
    if (config.groupChatId === undefined) throw new Error("GROUP_CHAT_ID is not configured on the server.");
    return config.groupChatId;
  };

  app.get("/me", (c) => c.json({ user: c.get("user"), isOwner: isOwner(c.get("user").id) }));

  app.get("/players", (c) => c.json(listPlayers().map(toDto)));

  app.post("/players", async (c) => {
    const { name, strength } = await c.req.json<{ name?: string; strength?: number }>();
    if (!name?.trim()) return c.json({ error: "Name is required" }, 400);
    if (!isStrength(strength)) return c.json({ error: "Strength must be 1–5" }, 400);
    return c.json(toDto(createGuest(name.trim(), strength)));
  });

  app.patch("/players/:id", async (c) => {
    const body = await c.req.json<{ strength?: number; displayName?: string | null; active?: boolean; isAdmin?: boolean }>();
    const target = getPlayer(Number(c.req.param("id")));
    if (!target) return c.json({ error: "Not found" }, 404);
    const patch: Parameters<typeof updatePlayer>[1] = {};
    if (body.strength !== undefined) {
      if (!isStrength(body.strength)) return c.json({ error: "Strength must be 1–5" }, 400);
      patch.strength = body.strength;
    }
    if (body.displayName !== undefined) patch.displayName = body.displayName?.trim() || null;
    if (body.active !== undefined) patch.active = Boolean(body.active);
    if (body.isAdmin !== undefined) {
      if (!isOwner(c.get("user").id)) return c.json({ error: "Only the owner can change admins." }, 403);
      if (target.tgUserId === null) return c.json({ error: "Guests can't be admins." }, 400);
      if (isOwner(target.tgUserId)) return c.json({ error: "The owner is always an admin." }, 400);
      patch.isAdmin = Boolean(body.isAdmin);
    }
    const player = updatePlayer(target.id, patch)!;
    if (patch.isAdmin !== undefined) await syncAdminCommands(api, player.tgUserId!, patch.isAdmin);
    return c.json(toDto(player));
  });

  app.get("/game", (c) => {
    const chat = ensureChat(groupChatId());
    const poll = latestPoll(chat.chatId);
    const voters = poll ? pollVoters(poll.pollId).map((v) => ({ ...v, player: toDto(v.player) })) : [];
    return c.json({ chat, poll: poll ?? null, voters });
  });

  app.patch("/settings", async (c) => {
    const body = await c.req.json<{ teamSize?: number; showTeamSums?: boolean }>();
    if (body.teamSize !== undefined && !isTeamSize(body.teamSize)) return c.json({ error: "Team size must be 1–20" }, 400);
    updateChat(groupChatId(), {
      ...(body.teamSize !== undefined ? { teamSize: body.teamSize } : {}),
      ...(body.showTeamSums !== undefined ? { showTeamSums: Boolean(body.showTeamSums) } : {}),
    });
    return c.json(ensureChat(groupChatId()));
  });

  /** Manually mark a player in/out of a poll (guests, people who RSVPed elsewhere). `status: null` removes them. */
  app.post("/polls/:pollId/attendees", async (c) => {
    const pollId = c.req.param("pollId");
    const { playerId, status } = await c.req.json<{ playerId: number; status: "in" | "out" | null }>();
    if (!getPoll(pollId)) return c.json({ error: "Poll not found" }, 404);
    if (!getPlayer(playerId)) return c.json({ error: "Player not found" }, 404);
    if (status !== null && status !== "in" && status !== "out") return c.json({ error: "Bad status" }, 400);
    setVote(pollId, playerId, status, true);
    return c.json({ ok: true });
  });

  app.post("/shuffle/preview", async (c) => {
    const { pollId, teamSize } = await c.req.json<{ pollId: string; teamSize?: number }>();
    if (teamSize !== undefined && !isTeamSize(teamSize)) return c.json({ error: "Team size must be 1–20" }, 400);
    return c.json(shuffleForPoll(pollId, groupChatId(), teamSize));
  });

  app.post("/shuffle/post", async (c) => {
    const { pollId, teamSize } = await c.req.json<{ pollId: string; teamSize?: number }>();
    if (teamSize !== undefined && !isTeamSize(teamSize)) return c.json({ error: "Team size must be 1–20" }, 400);
    const outcome = await postShuffle(api, { chatId: groupChatId(), pollId, teamSize });
    return c.json(outcome);
  });

  app.get("/shuffles", (c) =>
    c.json(listShuffles(groupChatId()).map((s) => ({ ...s, result: JSON.parse(s.resultJson), resultJson: undefined }))),
  );

  return app;
}
