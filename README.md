# Volleyball Shuffle Bot

Made by [@moonpie24](https://t.me/moonpie24).

A Telegram bot that posts an in/out poll in your group, tracks who's coming, and splits the players into balanced teams based on each player's strength (1 = beginner, 5 = advanced). Admins manage strength levels in a Telegram Mini App.

## How it works

1. Anyone runs `/poll` in the group. The bot posts a non-anonymous poll with "✅ In" and "❌ Out".
2. As people vote, the bot records who's in. New voters are added to the player list with strength 3 and marked **new**.
3. Anyone runs `/shuffle` or writes `@yourbot shuffle 3`. The bot replies with balanced teams and a 🔄 **Reshuffle** button.
4. In the bot's private chat, admins tap the **Players** menu button to open the mini app. There they set strength levels, add guests, add or remove attendees, preview teams, and see the shuffle history.

> **Why the bot posts the poll:** Telegram only tells a bot *who* voted in polls the bot sent itself. For polls that people post, it only sees the totals.

## Commands

Anyone in the group can use these, and tap 🔄 **Reshuffle**:

| Command | What it does |
|---|---|
| `/poll [time or question]` | Posts the in/out poll. `/poll 8pm` → "🏐 Volleyball, Wed 28 Oct at 8 PM: are you in?" (also `7:30pm`, `20:00`, `noon`, `midnight`). Any other text is used as the question |
| `/shuffle [teams]` | Teams from the latest poll. `/shuffle 3` makes 3 teams of 6. Reply to an older poll to use that one instead |
| `@bot shuffle [teams]` / `@bot poll` | The same, via mention |
| `/help` | Briefly explains the commands above. Also works in the bot's private chat |

Only bot admins can use these:

| Command | What it does |
|---|---|
| `/teamsize N` | Sets the team size (default 6) |
| `/sums on\|off` | Shows or hides each team's strength total in the group message |

**Who is an admin:** the owner (`OWNER_ID` in `.env`) is always an admin, and is the only person who can add or remove admins. Being an admin of the Telegram group doesn't count. To make someone an admin, the owner opens the mini app → **Players**, taps the person's name, and turns on **Admin**. That person has to be in the player list first: they get there by voting in a poll, or by sending `/start` to the bot.

**Admin panel:** open the bot's private chat and tap the **Players** menu button (or send `/app` there). The bot never posts anything in the group for this. Non-admins who open it see an "admins only" screen. In the group's `/` menu, everyone sees `/poll`, `/shuffle` and `/help`; only the owner and admins see the admin commands.

**Team sizing:** plain `/shuffle` makes `floor(players / size)` teams, with at least 2. `/shuffle X` makes X teams and fills them to the team size, so with 14 players `/shuffle 3` gives teams of 6, 6 and 2. If there aren't enough players for X teams, it makes as many as the players can fill. Reshuffling keeps the same number of teams. Either way, leftover players are spread across teams and listed at the bottom of their team as `(sub)`, rotating in. The teams message lists one player per line with their @username, so everyone gets pinged. The group never sees individual strength levels.

## Setup

1. **Create the bot**: in [@BotFather](https://t.me/BotFather), run `/newbot` and copy the token.
2. **Let it see mentions**: in BotFather, go to `/mybots` → your bot → *Bot Settings* → *Group Privacy* → **Turn off**. Or make the bot a group admin. (`/shuffle@yourbot` works either way.)
3. **Register the mini app**: run `/newapp` in BotFather, pick your bot, set the URL to your `PUBLIC_URL`, and choose a short name (for example `app`). The link becomes `t.me/yourbot/app`.
4. **Configure**: `cp .env.example .env` and fill it in. Set `OWNER_ID` to your Telegram user ID (ask @userinfobot). To find `GROUP_CHAT_ID`, add the bot to the group. The server logs `Added to chat "..." (id -100...)`.
5. **Run it.**

### Local development

```bash
npm install
npm run build:webapp
cloudflared tunnel --url http://localhost:8080   # gives you an https://….trycloudflare.com URL
# put that URL in PUBLIC_URL (and in BotFather /newapp → Edit Web App URL)
npm run dev
```

If `PUBLIC_URL` is empty, the bot uses long polling. The bot commands work that way, but the mini app needs a public HTTPS URL.

For hot reload of the mini app UI, run `npm run dev:webapp` (Vite on :5173, with `/api` proxied to :8080) and point the tunnel at 5173 instead.

### Deploy (Fly.io, Railway, or a VPS)

The `Dockerfile` builds one image that serves the webhook, the API and the mini app on `PORT` (8080). Mount a volume at `/data` so the SQLite database survives redeploys, and set the env vars from `.env.example`.

```bash
# Fly.io example
fly launch --no-deploy
fly volumes create data --size 1
# in fly.toml: [mounts] source="data" destination="/data"
fly secrets set BOT_TOKEN=... PUBLIC_URL=https://<app>.fly.dev GROUP_CHAT_ID=... WEBHOOK_SECRET=$(openssl rand -hex 16)
fly deploy
```

On startup the server runs database migrations and registers the webhook.

## Development

```bash
npm test            # algorithm + initData auth tests
npm run typecheck   # server + webapp
npm run db:generate # after changing src/db/schema.ts
```

Layout: `src/core` (pure shuffle and format logic), `src/bot` (grammY handlers), `src/db` (Drizzle schema and queries), `src/server` (Hono API with Telegram initData auth), `webapp/` (React mini app).
