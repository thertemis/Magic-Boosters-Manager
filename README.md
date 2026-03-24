# MTG Pack Simulator

A self-hosted web application for simulating Magic: The Gathering booster pack openings. Sync any set from Scryfall, grant packs to players, watch animated card reveals with 3D flips and confetti effects, manage collections, run an in-game economy, and connect a Discord bot through the built-in REST API.

//This is a vibe coded app using paid tool, so if you want to help me with the cost of it, please support me on Ko-Fi//

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/O5O71UV4QU)


![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-20%2B-green)
![PostgreSQL](https://img.shields.io/badge/database-PostgreSQL-blue)
![Docker](https://img.shields.io/badge/docker-compose-blue)

> **Card data** is provided by [Scryfall](https://scryfall.com) via their free public API. Magic: The Gathering and all card names/artwork are property of [Wizards of the Coast](https://magic.wizards.com). This project is not affiliated with or endorsed by Wizards of the Coast.

![Screenshot](https://github.com/thertemis/Magic-Boosters-Manager/blob/main/screenshot1.png)
---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [REST API & Discord Bot Integration](#rest-api--discord-bot-integration)
- [Updating an Existing Installation](#updating-an-existing-installation)
- [Backup & Restore](#backup--restore)
- [Development](#development)

---
![screenshot](https://github.com/thertemis/Magic-Boosters-Manager/blob/main/screenshot2.png)

## Features

### Pack Opening Experience
- Sync any Magic: The Gathering set directly from [Scryfall](https://scryfall.com/docs/api) with one click
- **Realistic pack composition** based on release date:
  - **Classic 15-card** (pre-2024 / Draft sets): 10 commons + 3 uncommons + 1 rare/mythic + 1 land
  - **Modern Play Booster 14-card** (2024+ sets): follows current Wizards print run ratios including wildcard and guaranteed foil slots
  - **Collector Booster 15-card**: all alt-art preferred, ~60% foil, exclusive extended art / showcase / borderless slots
- **Mythic rare chance**: 12.5% in rare/mythic slots
- **Foil detection**: rainbow shimmer overlay + FOIL badge on foil cards
- **Alt-art classification**: Showcase, Extended Art, Borderless, Full Art — each gets its own label
- **Animated reveal**: 3D flip animation per card; confetti burst on rare / mythic / foil pulls
- **Enlarged card modal**: shows USD price, estimated in-game currency value, and owned count

### Collection Management
- Browse your full card collection with filters: name search, Scryfall syntax (`r:rare c:g is:fullart`), rarity, color
- Sort by: Name, Owned Count, Price (high → low), Print Date (newest first)
- **Moxfield export**: download a copy-paste-ready text list or a Moxfield-compatible CSV
- Tag-based collection grouping (event prizes, marketplace, etc.)
- Collection items tagged as event prizes are locked from sale and trade

### Admin Tools
- **User management**: create, reset passwords, assign roles; invitation-code system for self-registration
- **Set sync**: fetch full card data (images, prices, oracle text, frame effects) from Scryfall
- **Grant packs**: grant any set's boosters to one or more players with optional tags and counts
- **Card Pool Editor**: disable/enable cards per set, or browse all installed sets at once; bulk Enable All / Disable All applies to the current filtered view; full Scryfall syntax filter support
- **Custom Booster DSL**: define your own slot distribution — e.g. `{r,75,m,25;u,100;c,100;c,100;c,100}` — with optional per-set overrides like `neo:r,75,neo:m,25`
- **Booster Schedule**: auto-grant packs or currency to all/specific users at a configured UTC hour daily
- **Decklist Checker**: paste a standard deck list and instantly see which cards any player owns/lacks
- **App Settings**: customize the application name and favicon shown to all users
- **Backup & Restore**: JSON snapshot of the entire database, downloadable and re-importable

### Economy & Marketplace
- **Master switch**: economy can be fully enabled or disabled; marketplace is hidden when disabled
- **Currency**: configurable name and symbol (default: Gold / G)
- **Daily claim**: players can claim a configurable daily currency amount (also distributed automatically via Booster Schedule)
- **Pack Store**: admin lists booster packs for sale at set prices with optional stock limits
- **Card Market**: player-to-player card listings with configurable price and quantity
- **Sell to Store**: sell cards back at Scryfall USD price × configurable multiplier (default: $1 → 100 G)
- **Price refresh**: admin can refresh all card prices from Scryfall's batch API at any time
- **Transaction log**: full audit trail of every currency movement

### REST API
- API key management (admin panel → API Keys)
- Grant packs or currency to one or many users — by app ID, username, or **Discord User ID**
- Update economy settings remotely
- Look up users by linked Discord ID (ideal for Discord bot slash commands)
- Full endpoint reference with request/response examples in-app at **Resources → API Docs**

### Player Profile & Discord Integration
- Players link their Discord account (enter Discord User ID in **Profile**)
- Once linked, Discord bots can identify users with a single API call — no manual ID mapping needed

### Internationalization
- English and French UI — each player picks their language from the sidebar

### Customization
- Admins can change the **application name** and **favicon** from the App Settings page — the change applies immediately to all users

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, TanStack Query v5, Framer Motion, canvas-confetti |
| UI | shadcn/ui (Radix UI primitives), Tailwind CSS, Lucide icons |
| Backend | Node.js 20, Express.js, TypeScript (tsx in dev / esbuild in production) |
| Auth | Passport.js (local strategy), express-session |
| Database | PostgreSQL 14+ via Drizzle ORM |
| Card Data | [Scryfall API](https://scryfall.com/docs/api) (free, no API key required) |
| Container | Docker 24+ + Docker Compose v2 |

---

## Requirements

- **PostgreSQL** 14+ database
- **Node.js** 20+ (manual setup) **or Docker + Docker Compose** (recommended)

---

## Installation

### Docker (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/your-username/mtg-pack-simulator.git
cd mtg-pack-simulator

# 2. Configure environment
cp .env.example .env
# Edit .env — set strong values for POSTGRES_PASSWORD and SESSION_SECRET

# 3. Start
docker compose up -d
```

The app runs at **http://localhost:5000** (or whatever `APP_PORT` you set).

**Default admin login:** `admin` / `admin` — change the password immediately after first login.

---

### Manual Setup

```bash
# 1. Install Node.js dependencies
npm install

# 2. Set environment variables
export DATABASE_URL="postgresql://user:password@localhost:5432/mtg"
export SESSION_SECRET="a-random-string-at-least-32-chars"

# 3. Create / update the database schema
npm run db:push

# 4a. Development server (with hot reload)
npm run dev

# 4b. Production build + start
npm run build
npm start
```

---

## Configuration

### `.env` / Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `SESSION_SECRET` | ✅ | Random secret for session cookie signing (min 32 chars) |
| `PORT` | ❌ | HTTP port (default: `5000`) |
| `NODE_ENV` | ❌ | `production` or `development` |

Docker Compose additionally uses:

| Variable | Description |
|---|---|
| `POSTGRES_USER` | PostgreSQL username |
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `POSTGRES_DB` | PostgreSQL database name |
| `APP_PORT` | Host port to expose the app on |

### In-App Settings

Configure via **Admin → Economy**:
- Currency name, symbol, daily claim amount, sell rate (USD → in-game currency)
- Enable/disable marketplace, pack store, player-to-player trading

Configure via **Admin → App Settings**:
- Application name (shown in sidebar, browser tab, and API)
- Favicon (PNG, ICO, SVG — replaces browser tab icon)

---

## REST API & Discord Bot Integration

All API-key-protected endpoints accept the key as:

```
X-Api-Key: mtg_your_key_here
```
or as a query parameter: `?api_key=mtg_your_key_here`

Generate API keys from **Admin → API Keys**.

### Endpoint Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/users` | API Key | List all users (includes `discordUserId`) |
| `GET` | `/api/v1/users/discord/:discordId` | API Key | Look up a user by Discord User ID |
| `PATCH` | `/api/v1/users/:id/discord` | API Key | Set or clear a user's Discord ID |
| `GET` | `/api/v1/users/:id/collection` | API Key | Get a user's card collection |
| `GET` | `/api/v1/users/:id/balance` | API Key | Get a user's currency balance |
| `GET` | `/api/v1/users/:id/packs` | API Key | Get a user's packs |
| `POST` | `/api/v1/users/:id/decklist-check` | API Key | Check a decklist against a user's collection |
| `POST` | `/api/v1/users/grant-packs` | API Key | Grant packs to one or many users |
| `POST` | `/api/v1/users/grant-currency` | API Key | Grant / deduct currency for one or many users |
| `GET` | `/api/v1/economy` | API Key | Get economy / marketplace settings |
| `PATCH` | `/api/v1/settings` | API Key | Update economy settings remotely |
| `GET` | `/api/v1/sets` | API Key | List all installed sets |
| `GET` | `/api/v1/sets/:code/cards` | API Key | Get all cards in a set |
| `GET` | `/api/app/settings` | Public | Get app name and favicon status |
| `GET` | `/api/player/profile` | Session | Get own profile (includes `discordUserId`) |
| `PATCH` | `/api/player/discord` | Session | Link or unlink own Discord ID |

Full request/response examples are available in-app at **Resources → API Docs**.

---

### Grant Packs Example

```bash
curl -X POST https://your-app.example.com/api/v1/users/grant-packs \
  -H "X-Api-Key: mtg_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "targets": [
      { "discordId": "123456789012345678" },
      { "username": "alice" }
    ],
    "setCode": "dsk",
    "packType": "play_booster",
    "count": 3,
    "tag": "tournament-prize"
  }'
```

`targets` can be any mix of `{ "id": 1 }`, `{ "username": "alice" }`, `{ "discordId": "..." }`, or the special string `"all"` to broadcast to every user.

### Grant Currency Example

```bash
curl -X POST https://your-app.example.com/api/v1/users/grant-currency \
  -H "X-Api-Key: mtg_abc123" \
  -H "Content-Type: application/json" \
  -d '{ "targets": "all", "amount": 100, "description": "Weekly participation bonus" }'
```

### Update Settings Example

```bash
curl -X PATCH https://your-app.example.com/api/v1/settings \
  -H "X-Api-Key: mtg_abc123" \
  -H "Content-Type: application/json" \
  -d '{ "economyEnabled": true, "currencyName": "Coins", "dailyClaimAmount": 250 }'
```

---

### Discord Bot Integration

Players link their Discord account in **Profile → Discord Integration** by entering their Discord User ID. Once linked your bot can resolve any player with one API call.

**Suggested slash commands:**

| Command | API flow |
|---|---|
| `/profile` | Discord ID → user lookup → balance |
| `/collection` | Discord ID → user lookup → collection |
| `/decklist @player` | Resolve user → `POST /decklist-check` |
| `/grantpack @player <set>` | Resolve user → `POST /grant-packs` |
| `/reward @winner` | `POST /grant-packs` + `POST /grant-currency` |
| `/weekly-bonus` | `POST /grant-currency` with `"targets": "all"` |
| `/event-start <set>` | `POST /grant-packs` to all with event tag |

**discord.js v14 example:**

```js
// /grantpack slash command handler
const discordId = interaction.options.getUser('player').id;
const setCode   = interaction.options.getString('set');

// 1. Resolve Discord user → simulator user
const userRes = await fetch(`${APP_URL}/api/v1/users/discord/${discordId}`, {
  headers: { 'X-Api-Key': API_KEY }
});
if (!userRes.ok) {
  return interaction.reply('❌ That player has not linked their Discord account in the simulator.\nAsk them to visit **Profile** → **Discord Integration**.');
}
const { id: userId, username } = await userRes.json();

// 2. Grant the pack
await fetch(`${APP_URL}/api/v1/users/grant-packs`, {
  method: 'POST',
  headers: { 'X-Api-Key': API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    targets: [{ id: userId }],
    setCode,
    packType: 'play_booster',
    count: 1
  })
});

await interaction.reply(`✅ Granted **${username}** a **${setCode.toUpperCase()}** pack! Open it in the simulator.`);
```

---

## Updating an Existing Installation

### GitHub (Manual) Update

```bash
# 1. Pull the latest code
git pull origin main

# 2. Install any new dependencies
npm install

# 3. Apply database schema changes (safe — never drops existing data)
npm run db:push

# 4. Rebuild the frontend
npm run build

# 5. Restart the server
pm2 restart mtg          # PM2
# or: systemctl restart mtg
```

> `npm run db:push` only **adds** new columns or tables. Your data (users, cards, collections, packs) is never touched.

---

### Docker Update

```bash
# 1. Pull latest code
git pull origin main

# 2. Rebuild and restart containers
docker compose down
docker compose build --no-cache
docker compose up -d
```

Your data lives in the PostgreSQL Docker volume and is preserved across updates.

---

## Backup & Restore

Go to **Admin → Backup**:

- **Download Backup** — exports a complete JSON snapshot: users, sets, cards, packs, collections, economy settings, marketplace data, booster templates, API keys.
- **Restore** — upload a previously downloaded JSON to fully replace the current state.

**Migrating to a new server:**
1. Download a backup on the old instance.
2. Stand up the new instance (Docker or manual).
3. Upload the backup via **Admin → Backup → Restore**.

---

## Custom Booster DSL

Admins can create custom booster templates with the built-in DSL:

```
{slot1;slot2;...}
```

Each slot is a list of `rarity,probability` pairs (must sum to 100):
- `c` = common, `u` = uncommon, `r` = rare, `m` = mythic
- Optional set prefix: `neo:r,75,neo:m,25` (pulls only from that set)

**Examples:**

```
# Standard rare/mythic + 3 uncommons + 10 commons
{r,75,m,25;u,100;u,100;u,100;c,100;c,100;c,100;c,100;c,100;c,100;c,100;c,100;c,100}

# All-mythic collector pack (5 cards)
{m,100;m,100;m,100;m,100;m,100}

# NEO rare/mythic + generic uncommon + commons
{neo:r,75,neo:m,25;u,100;c,100;c,100;c,100}
```

---

## Development

```bash
npm run dev       # Start with HMR (Vite + Express on port 5000)
npm run db:push   # Sync Drizzle schema to the database
npm run build     # Production build (client → dist/public, server → dist/index.cjs)
```

**Project layout:**

```
client/src/
  pages/          React page components
  components/     Shared UI components (NavBar, CardDisplay, etc.)
  lib/            QueryClient, i18n, utilities
  hooks/          Custom hooks (useAuth, usePlayerPacks, etc.)

server/
  routes.ts       All Express routes
  storage.ts      Database access layer (IStorage interface + DatabaseStorage)
  db.ts           Drizzle ORM setup

shared/
  schema.ts       Drizzle table definitions + Zod validation schemas
  routes.ts       Shared route/input/output contract (used by both client and server)
  scryfall-filter.ts  Client-safe Scryfall query parser
```

Card data is fetched from the Scryfall API on first sync and cached locally. Scryfall's rate limit guidelines (100 ms between batch requests) are respected automatically.
