import { useEffect, useState } from "react";
import { api, type ShuffleRecord } from "./api";
import { TeamsView } from "./TeamsView";

export function History() {
  const [items, setItems] = useState<ShuffleRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.shuffles().then(setItems).catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!items) return <p className="muted">Loading…</p>;
  if (items.length === 0) return <p className="muted">No shuffles yet.</p>;

  return (
    <section>
      {items.map((s) => (
        <details key={s.id} className="card">
          <summary>
            {new Date(s.createdAt * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            <span className="muted">
              {" "}
              · {s.result.total} players · {s.result.teams.length} × {s.teamSize}
            </span>
          </summary>
          <TeamsView result={s.result} />
        </details>
      ))}
    </section>
  );
}
