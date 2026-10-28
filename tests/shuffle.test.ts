import { describe, expect, it } from "vitest";
import { formatTeams } from "../src/core/format.js";
import { mulberry32, shuffleTeams, type ShufflePlayer } from "../src/core/shuffle.js";

function makePlayers(n: number, rng = mulberry32(1)): ShufflePlayer[] {
  return Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `P${i + 1}`, strength: 1 + Math.floor(rng() * 5) }));
}

const ids = (r: ReturnType<typeof shuffleTeams>) => r.teams.flatMap((t) => t.players.map((p) => p.id)).sort((a, b) => a - b);

describe("shuffleTeams", () => {
  it("rejects fewer than 2 players", () => {
    expect(() => shuffleTeams([], 6)).toThrow();
    expect(() => shuffleTeams(makePlayers(1), 6)).toThrow();
  });

  it("splits 2 players into 2 teams of 1", () => {
    const r = shuffleTeams(makePlayers(2), 6);
    expect(r.teams.map((t) => t.players.length)).toEqual([1, 1]);
  });

  it("makes 2 smaller teams when there are fewer than 2 × size players", () => {
    const r = shuffleTeams(makePlayers(9), 6);
    expect(r.teams).toHaveLength(2);
    expect(r.teams.map((t) => t.players.length).sort()).toEqual([4, 5]);
    expect(r.teams.every((t) => t.subIds.length === 0)).toBe(true);
  });

  it("uses every player exactly once and spreads leftovers as subs", () => {
    const r = shuffleTeams(makePlayers(14), 6);
    expect(r.teams).toHaveLength(2);
    expect(ids(r)).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
    expect(r.teams.map((t) => t.players.length)).toEqual([7, 7]);
    expect(r.teams.map((t) => t.subIds.length)).toEqual([1, 1]);
  });

  it("makes floor(n / size) teams with sizes differing by at most 1", () => {
    const r = shuffleTeams(makePlayers(20), 6);
    expect(r.teams).toHaveLength(3);
    const sizes = r.teams.map((t) => t.players.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });

  it("keeps team strength sums close on random inputs", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = mulberry32(seed);
      const n = 8 + Math.floor(rng() * 20);
      const size = 4 + Math.floor(rng() * 3);
      const r = shuffleTeams(makePlayers(n, rng), size, rng);
      const sums = r.teams.map((t) => t.sum);
      expect(Math.max(...sums) - Math.min(...sums), `seed ${seed}`).toBeLessThanOrEqual(2);
    }
  });

  it("produces different teams on different seeds", () => {
    const players = makePlayers(12);
    const signature = (seed: number) =>
      shuffleTeams(players, 6, mulberry32(seed)).teams.map((t) => t.players.map((p) => p.id).join(",")).join("|");
    const seen = new Set(Array.from({ length: 10 }, (_, s) => signature(s)));
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("formatTeams", () => {
  it("lists teams, marks subs, and hides sums unless asked", () => {
    const r = shuffleTeams(makePlayers(14), 6, mulberry32(3));
    const text = formatTeams(r, { showSums: false });
    expect(text).toContain("14 players, 2 × 6 (+2 subs)");
    expect(text).toContain("<b>Team 1</b>:");
    expect(text).not.toContain("Σ");
    expect(formatTeams(r, { showSums: true })).toContain("Σ");
  });

  it("escapes HTML in names", () => {
    const r = shuffleTeams(
      [
        { id: 1, name: "<b>x</b>", strength: 3 },
        { id: 2, name: "A&B", strength: 3 },
      ],
      6,
    );
    const text = formatTeams(r, { showSums: false });
    expect(text).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(text).toContain("A&amp;B");
  });
});
