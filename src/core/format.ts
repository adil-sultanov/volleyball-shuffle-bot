import type { ShuffleResult } from "./shuffle.js";

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Telegram HTML message listing the teams. Individual strengths are never shown. */
export function formatTeams(result: ShuffleResult, opts: { showSums: boolean; title?: string }): string {
  const { teams, total, teamSize } = result;
  const subs = teams.reduce((n, t) => n + t.subIds.length, 0);
  const header =
    `🏐 <b>${escapeHtml(opts.title ?? "Teams")}</b>: ${total} players, ${teams.length} × ${teamSize}` +
    (subs ? ` (+${subs} sub${subs > 1 ? "s" : ""})` : "");

  const lines = teams.map((t, i) => {
    const names = t.players.map((p) => escapeHtml(p.name) + (t.subIds.includes(p.id) ? "*" : "")).join(", ");
    const sum = opts.showSums ? ` (Σ ${t.sum})` : "";
    return `<b>Team ${i + 1}</b>${sum}: ${names}`;
  });

  return [header, "", ...lines, ...(subs ? ["", "<i>* sub / rotate in</i>"] : [])].join("\n");
}
