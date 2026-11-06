export interface ShufflePlayer {
  id: number;
  name: string;
  /** Telegram @username without the @, if the player has one. */
  username?: string;
  strength: number;
}

export interface Team {
  players: ShufflePlayer[];
  /** Ids of players beyond `teamSize` who rotate in. */
  subIds: number[];
  sum: number;
}

export interface ShuffleResult {
  teams: Team[];
  teamSize: number;
  total: number;
  /** Number of teams asked for with `/shuffle X`, kept so a reshuffle makes the same request. */
  requestedTeams?: number;
}

export type Rng = () => number;

/** Small seedable PRNG so tests are reproducible. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const sumOf = (ps: ShufflePlayer[]) => ps.reduce((s, p) => s + p.strength, 0);

/** Lower is better: primary = max−min spread, secondary = sum of squared sums (variance proxy). */
function score(sums: number[], weights: number[]): [number, number] {
  const scaled = sums.map((s, i) => s * weights[i]);
  return [Math.max(...scaled) - Math.min(...scaled), scaled.reduce((s, x) => s + x * x, 0)];
}

const better = (a: [number, number], b: [number, number]) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);

/** With `requested`, never makes more teams than the players can fill, so no team ends up empty. */
export function teamCount(n: number, teamSize: number, requested?: number): number {
  if (requested === undefined) return Math.max(2, Math.floor(n / teamSize));
  return Math.max(2, Math.min(requested, Math.ceil(n / teamSize)));
}

/**
 * A requested team count fills each team to `teamSize`, so only the last team can come up short.
 * Its load and strength are scaled up so it fills exactly and matches the others on average, not
 * in total. Weights stay 1 when every team is full, or there are too few players to fill even one.
 */
function teamWeights(n: number, teamSize: number, numTeams: number, requested?: number): number[] {
  const weights = new Array<number>(numTeams).fill(1);
  const lastTeam = n - (numTeams - 1) * teamSize;
  if (requested !== undefined && lastTeam > 0 && lastTeam < teamSize) weights[numTeams - 1] = teamSize / lastTeam;
  return weights;
}

export function shuffleTeams(
  input: ShufflePlayer[],
  teamSize: number,
  rng: Rng = Math.random,
  requestedTeams?: number,
): ShuffleResult {
  if (input.length < 2) throw new Error("Need at least 2 players to make teams");
  if (!Number.isInteger(teamSize) || teamSize < 1) throw new Error("Team size must be a positive integer");

  const numTeams = teamCount(input.length, teamSize, requestedTeams);
  const weights = teamWeights(input.length, teamSize, numTeams, requestedTeams);

  // Random order first, then a stable sort: equal-strength players land in a new order every time.
  const sorted = shuffleInPlace([...input], rng).sort((a, b) => b.strength - a.strength);

  // Greedy: fill the emptiest team, ties broken by lowest sum, then randomly.
  const teams: ShufflePlayer[][] = Array.from({ length: numTeams }, () => []);
  for (const p of sorted) {
    const order = shuffleInPlace([...teams.keys()], rng);
    let best = order[0];
    for (const i of order) {
      const load = teams[i].length * weights[i];
      const bestLoad = teams[best].length * weights[best];
      const lighter = sumOf(teams[i]) * weights[i] < sumOf(teams[best]) * weights[best];
      if (load < bestLoad || (load === bestLoad && lighter)) best = i;
    }
    teams[best].push(p);
  }

  // Local search: one-for-one swaps keep team sizes intact. Take any improving swap until none is left.
  const sums = teams.map(sumOf);
  let current = score(sums, weights);
  for (let round = 0; round < 50; round++) {
    let improved = false;
    for (const a of shuffleInPlace([...teams.keys()], rng)) {
      for (let b = 0; b < numTeams; b++) {
        if (a === b) continue;
        for (let i = 0; i < teams[a].length; i++) {
          for (let j = 0; j < teams[b].length; j++) {
            const d = teams[b][j].strength - teams[a][i].strength;
            if (d === 0) continue;
            sums[a] += d;
            sums[b] -= d;
            const next = score(sums, weights);
            if (better(next, current)) {
              [teams[a][i], teams[b][j]] = [teams[b][j], teams[a][i]];
              current = next;
              improved = true;
            } else {
              sums[a] -= d;
              sums[b] += d;
            }
          }
        }
      }
    }
    if (!improved) break;
  }

  return {
    teamSize,
    total: input.length,
    ...(requestedTeams === undefined ? {} : { requestedTeams }),
    teams: teams.map((players) => {
      const extra = Math.max(0, players.length - teamSize);
      const subIds = shuffleInPlace(players.map((p) => p.id), rng).slice(0, extra);
      // Alphabetical, with subs at the bottom.
      const isSub = (p: ShufflePlayer) => (subIds.includes(p.id) ? 1 : 0);
      return {
        players: [...players].sort((x, y) => isSub(x) - isSub(y) || x.name.localeCompare(y.name)),
        subIds,
        sum: sumOf(players),
      };
    }),
  };
}
