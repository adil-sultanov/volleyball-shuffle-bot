import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type Chat, type Player, type Poll, type ShuffleResult, type Voter } from "./api";
import { TeamsView } from "./TeamsView";
import { confirm, haptic, notify } from "./telegram";

export function Game() {
  const [data, setData] = useState<{ chat: Chat; poll: Poll | null; voters: Voter[] } | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teamSize, setTeamSize] = useState(6);
  const [preview, setPreview] = useState<ShuffleResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [game, all] = await Promise.all([api.game(), api.players()]);
      setData(game);
      setPlayers(all);
      setTeamSize(game.chat.teamSize);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const going = useMemo(() => data?.voters.filter((v) => v.status === "in") ?? [], [data]);
  const out = useMemo(() => data?.voters.filter((v) => v.status === "out") ?? [], [data]);
  const addable = useMemo(() => {
    const inIds = new Set(going.map((v) => v.player.id));
    return players.filter((p) => p.active && !inIds.has(p.id));
  }, [players, going]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;
  if (!data.poll) return <p className="muted">No poll yet. Run /poll in the group to start one.</p>;
  const poll = data.poll;

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    try {
      return await fn();
    } catch (e) {
      haptic("error");
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const setAttendee = (playerId: number, status: "in" | null) =>
    run(async () => {
      await api.setAttendee(poll.pollId, playerId, status);
      setPreview(null);
      await load();
    });

  const changeTeamSize = (n: number) => {
    if (n < 1 || n > 20) return;
    setTeamSize(n);
    setPreview(null);
    void api.updateSettings({ teamSize: n });
  };

  const toggleSums = (on: boolean) =>
    run(async () => {
      const chat = await api.updateSettings({ showTeamSums: on });
      setData((d) => (d ? { ...d, chat } : d));
    });

  const doPreview = () =>
    run(async () => {
      setPreview((await api.preview(poll.pollId, teamSize)).result);
      haptic("success");
    });

  const doPost = () =>
    run(async () => {
      if (!(await confirm(`Post teams for ${going.length} players to the group?`))) return;
      setPreview((await api.post(poll.pollId, teamSize)).result);
      haptic("success");
    });

  return (
    <section>
      <div className="card">
        <div className="poll-q">{poll.question}</div>
        <div className="muted">
          {going.length} in · {out.length} out{poll.closed ? " · closed" : ""}
        </div>
      </div>

      <h3>Playing ({going.length})</h3>
      <ul className="list compact">
        {going.map((v) => (
          <li key={v.player.id} className="row-main">
            <span>
              {v.player.name}
              {v.manual && <span className="badge">added</span>}
              {!v.player.rated && <span className="badge warn">unrated</span>}
            </span>
            <span className="row-right">
              <span className="muted">{v.player.strength}</span>
              <button className="icon" aria-label="Remove" disabled={busy} onClick={() => setAttendee(v.player.id, null)}>
                ×
              </button>
            </span>
          </li>
        ))}
      </ul>

      {addable.length > 0 && (
        <select
          className="add-select"
          value=""
          disabled={busy}
          onChange={(e) => e.target.value && setAttendee(Number(e.target.value), "in")}
        >
          <option value="">+ Add a player or guest…</option>
          {addable.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {out.some((v) => v.player.id === p.id) ? " (voted out)" : ""}
            </option>
          ))}
        </select>
      )}

      <div className="card settings">
        <div className="setting">
          <span>Team size</span>
          <div className="stepper">
            <button onClick={() => changeTeamSize(teamSize - 1)}>−</button>
            <b>{teamSize}</b>
            <button onClick={() => changeTeamSize(teamSize + 1)}>+</button>
          </div>
        </div>
        <label className="setting">
          <span>Show team totals in the group</span>
          <input type="checkbox" checked={data.chat.showTeamSums} onChange={(e) => toggleSums(e.target.checked)} />
        </label>
      </div>

      <div className="actions">
        <button disabled={busy || going.length < 2} onClick={doPreview}>
          Preview
        </button>
        <button className="primary" disabled={busy || going.length < 2} onClick={doPost}>
          Post to group
        </button>
      </div>

      {preview && <TeamsView result={preview} />}
    </section>
  );
}
