import { tg } from "./telegram";

export interface Player {
  id: number;
  tgUserId: number | null;
  firstName: string;
  lastName: string | null;
  username: string | null;
  displayName: string | null;
  name: string;
  strength: number;
  rated: boolean;
  active: boolean;
  isAdmin: boolean;
}

export interface Chat {
  chatId: number;
  title: string | null;
  teamSize: number;
  showTeamSums: boolean;
}

export interface Poll {
  pollId: string;
  question: string;
  closed: boolean;
  createdAt: number;
}

export interface Voter {
  player: Player;
  status: "in" | "out";
  manual: boolean;
}

export interface Team {
  players: { id: number; name: string; strength: number }[];
  subIds: number[];
  sum: number;
}

export interface ShuffleResult {
  teams: Team[];
  teamSize: number;
  total: number;
}

export interface ShuffleRecord {
  id: number;
  teamSize: number;
  createdAt: number;
  result: ShuffleResult;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      Authorization: `tma ${tg?.initData ?? ""}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  me: () => request<{ user: { id: number; first_name: string }; isOwner: boolean }>("GET", "/me"),
  players: () => request<Player[]>("GET", "/players"),
  addGuest: (name: string, strength: number) => request<Player>("POST", "/players", { name, strength }),
  updatePlayer: (id: number, patch: Partial<Pick<Player, "strength" | "displayName" | "active" | "isAdmin">>) =>
    request<Player>("PATCH", `/players/${id}`, patch),
  game: () => request<{ chat: Chat; poll: Poll | null; voters: Voter[] }>("GET", "/game"),
  updateSettings: (patch: Partial<Pick<Chat, "teamSize" | "showTeamSums">>) => request<Chat>("PATCH", "/settings", patch),
  setAttendee: (pollId: string, playerId: number, status: "in" | "out" | null) =>
    request("POST", `/polls/${encodeURIComponent(pollId)}/attendees`, { playerId, status }),
  preview: (pollId: string, teamSize: number) =>
    request<{ result: ShuffleResult; text: string }>("POST", "/shuffle/preview", { pollId, teamSize }),
  post: (pollId: string, teamSize: number) =>
    request<{ result: ShuffleResult }>("POST", "/shuffle/post", { pollId, teamSize }),
  shuffles: () => request<ShuffleRecord[]>("GET", "/shuffles"),
};
