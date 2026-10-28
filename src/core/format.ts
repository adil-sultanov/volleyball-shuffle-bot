import type { ShuffleResult } from "./shuffle.js";

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const TEAM_COLORS = ["🔴", "🔵", "🟢", "🟡", "🟣", "🟠", "🟤", "⚪"];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Telegram HTML message listing the teams, one player per line:
 *
 *   🔴 Team 1
 *   Anna K. @anna
 *   Bek @bek (sub)
 *
 * Individual strengths are never shown.
 */
export function formatTeams(result: ShuffleResult, opts: { showSums: boolean }): string {
  const { teams, total } = result;
  const subs = teams.reduce((n, t) => n + t.subIds.length, 0);

  const summary = [plural(total, "player"), plural(teams.length, "team"), ...(subs ? [plural(subs, "sub")] : [])];
  const header = [`🏐 <b>TEAMS ARE READY</b>`, `👥 ${summary.join(" · ")}`];

  const blocks = teams.map((t, i) => {
    const color = TEAM_COLORS[i % TEAM_COLORS.length];
    const sum = opts.showSums ? `  ·  <i>strength ${t.sum}</i>` : "";
    const lines = t.players.map((p) => {
      const username = p.username ? ` @${escapeHtml(p.username)}` : "";
      const sub = t.subIds.includes(p.id) ? " <i>(sub)</i>" : "";
      return `${escapeHtml(p.name)}${username}${sub}`;
    });
    return [`${color} <b>Team ${i + 1}</b>${sum}`, ...lines].join("\n");
  });

  return [header.join("\n"), ...blocks, "Good luck & have fun! 💪"].join("\n\n");
}
