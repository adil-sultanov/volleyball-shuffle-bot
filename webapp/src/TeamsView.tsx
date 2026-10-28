import type { ShuffleResult } from "./api";

/** Admin-facing view of a shuffle: shows team sums and each player's level. */
export function TeamsView({ result }: { result: ShuffleResult }) {
  return (
    <div className="teams">
      {result.teams.map((t, i) => (
        <div key={i} className="team">
          <div className="team-head">
            <b>Team {i + 1}</b>
            <span className="muted">Σ {t.sum}</span>
          </div>
          <div className="team-players">
            {t.players.map((p) => (
              <span key={p.id} className="pill">
                {p.name}
                {t.subIds.includes(p.id) && "*"}
                <small>{p.strength}</small>
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
