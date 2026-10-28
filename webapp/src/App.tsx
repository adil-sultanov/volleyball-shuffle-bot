import { useEffect, useState } from "react";
import { api } from "./api";
import { Game } from "./Game";
import { History } from "./History";
import { Players } from "./Players";

const TABS = [
  { id: "players", label: "Players" },
  { id: "game", label: "Game" },
  { id: "history", label: "History" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function App() {
  const [tab, setTab] = useState<TabId>("players");
  const [authError, setAuthError] = useState<string | null>(null);
  const [me, setMe] = useState<{ id: number; isOwner: boolean } | null>(null);

  useEffect(() => {
    api
      .me()
      .then((r) => setMe({ id: r.user.id, isOwner: r.isOwner }))
      .catch((e: Error) => setAuthError(e.message));
  }, []);

  if (authError) {
    return (
      <div className="center">
        <div className="big">🔒</div>
        <p>{authError}</p>
      </div>
    );
  }
  if (!me) return <div className="center muted">Loading…</div>;

  return (
    <>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "tab active" : "tab"} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      <main>
        {tab === "players" && <Players me={me} />}
        {tab === "game" && <Game />}
        {tab === "history" && <History />}
      </main>
      <footer className="credit">
        Made by <a href="https://t.me/moonpie24">@moonpie24</a>
      </footer>
    </>
  );
}
