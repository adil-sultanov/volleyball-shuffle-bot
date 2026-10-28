import { useEffect, useMemo, useState } from "react";
import { api, type Player } from "./api";
import { StrengthPicker } from "./StrengthPicker";
import { haptic, notify } from "./telegram";

type Filter = "all" | "unrated" | "inactive";

export function Players({ me }: { me: { id: number; isOwner: boolean } }) {
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    api.players().then(setPlayers).catch((e: Error) => notify(e.message));
  }, []);

  const replace = (p: Player) => setPlayers((list) => list?.map((x) => (x.id === p.id ? p : x)) ?? null);

  /** Optimistic update; rolls back on error. */
  async function update(p: Player, patch: Partial<Pick<Player, "strength" | "displayName" | "active" | "isAdmin">>) {
    replace({ ...p, ...patch, ...(patch.strength !== undefined ? { rated: true } : {}) });
    haptic("select");
    try {
      replace(await api.updatePlayer(p.id, patch));
    } catch (e) {
      replace(p);
      haptic("error");
      notify((e as Error).message);
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (players ?? []).filter((p) => {
      if (filter === "unrated" && p.rated) return false;
      if (filter === "inactive" ? p.active : !p.active) return false;
      if (!q) return true;
      return [p.name, p.firstName, p.lastName, p.username].some((s) => s?.toLowerCase().includes(q));
    });
  }, [players, query, filter]);

  if (!players) return <p className="muted">Loading players…</p>;

  const unratedCount = players.filter((p) => !p.rated && p.active).length;

  return (
    <section>
      <input className="search" placeholder="Search players" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="chips">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>
          All
        </Chip>
        <Chip active={filter === "unrated"} onClick={() => setFilter("unrated")}>
          New{unratedCount ? ` (${unratedCount})` : ""}
        </Chip>
        <Chip active={filter === "inactive"} onClick={() => setFilter("inactive")}>
          Inactive
        </Chip>
        <button className="chip add" onClick={() => setAdding((a) => !a)}>
          + Guest
        </button>
      </div>

      {adding && (
        <AddGuest
          onAdded={(p) => {
            setPlayers((list) => [...(list ?? []), p].sort((a, b) => a.name.localeCompare(b.name)));
            setAdding(false);
          }}
        />
      )}

      {visible.length === 0 && (
        <p className="muted">
          {players.length === 0 ? "No players yet. They appear here when they vote in a /poll." : "Nobody matches."}
        </p>
      )}

      <ul className="list">
        {visible.map((p) => (
          <li key={p.id} className="row">
            <div className="row-main">
              <button className="name" onClick={() => setEditing(editing === p.id ? null : p.id)}>
                <span>{p.name}</span>
                {(p.isAdmin || p.tgUserId === me.id) && <span className="badge">admin</span>}
                {!p.rated && <span className="badge">new</span>}
                <span className="sub">{p.username ? `@${p.username}` : p.tgUserId ? "" : "guest"}</span>
              </button>
              <StrengthPicker value={p.strength} onChange={(strength) => update(p, { strength })} />
            </div>
            {editing === p.id && (
              <EditPlayer
                player={p}
                // Only the owner manages admins, and the owner's own row has no toggle.
                canManageAdmin={me.isOwner && p.tgUserId !== null && p.tgUserId !== me.id}
                onSave={(patch) => update(p, patch)}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={active ? "chip on" : "chip"} onClick={onClick}>
      {children}
    </button>
  );
}

function EditPlayer({
  player,
  canManageAdmin,
  onSave,
}: {
  player: Player;
  canManageAdmin: boolean;
  onSave: (patch: { displayName?: string | null; active?: boolean; isAdmin?: boolean }) => void;
}) {
  const [displayName, setDisplayName] = useState(player.displayName ?? "");
  return (
    <div className="edit">
      <label>
        Display name
        <input
          value={displayName}
          placeholder={player.firstName}
          onChange={(e) => setDisplayName(e.target.value)}
          onBlur={() => displayName !== (player.displayName ?? "") && onSave({ displayName: displayName || null })}
        />
      </label>
      <label className="toggle">
        <input type="checkbox" checked={player.active} onChange={(e) => onSave({ active: e.target.checked })} />
        Active (inactive players are hidden from the main list)
      </label>
      {canManageAdmin && (
        <label className="toggle">
          <input type="checkbox" checked={player.isAdmin} onChange={(e) => onSave({ isAdmin: e.target.checked })} />
          Admin (can post polls, shuffle teams, and edit players)
        </label>
      )}
    </div>
  );
}

function AddGuest({ onAdded }: { onAdded: (p: Player) => void }) {
  const [name, setName] = useState("");
  const [strength, setStrength] = useState(3);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      onAdded(await api.addGuest(name.trim(), strength));
      haptic("success");
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card guest" onSubmit={submit}>
      <input autoFocus placeholder="Guest name" value={name} onChange={(e) => setName(e.target.value)} />
      <StrengthPicker value={strength} onChange={setStrength} />
      <button className="primary" disabled={busy || !name.trim()}>
        Add
      </button>
    </form>
  );
}
