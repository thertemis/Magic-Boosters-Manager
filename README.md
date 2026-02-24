# MTG Pack Simulator

//This is a vibe coded app using paid tool, so i you want to help me with the cost of it, please support me on Ko-Fi//
[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/O5O71UV4QU)

A web-based Magic: The Gathering booster pack simulator. Administrators sync card sets from the Scryfall API, manage players via invitation codes, and grant booster packs. Players open packs with animated card reveals (3D flip animations, confetti effects for rare pulls), build collections, and export to Moxfield-compatible formats.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

---

## Table of Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Tech Stack](#tech-stack)
- [Requirements](#requirements)
- [Installation](#installation)
  - [Docker (Recommended)](#docker-recommended)
  - [Manual Setup](#manual-setup)
- [Configuration](#configuration)
- [Usage Guide](#usage-guide)
  - [First Launch](#first-launch)
  - [Admin Panel](#admin-panel)
    - [User Management](#user-management)
    - [Set Management](#set-management)
    - [Grant Packs](#grant-packs)
    - [Card Pool Editor](#card-pool-editor)
    - [Custom Booster Maker](#custom-booster-maker)
    - [Backup & Restore](#backup--restore)
  - [Player Experience](#player-experience)
    - [Opening Packs](#opening-packs)
    - [Collection Browser](#collection-browser)
    - [Exporting Collections](#exporting-collections)
- [Booster Distribution Rules](#booster-distribution-rules)
- [Custom Booster DSL Reference](#custom-booster-dsl-reference)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Scryfall Integration** — Sync any MTG set directly from the Scryfall API with full card data, images, and metadata
- **Invitation-Based Registration** — Players register using admin-generated invitation codes
- **Era-Appropriate Boosters** — Pre-2024 sets use classic 15-card draft format; 2024+ sets use the modern 14-card Play Booster format
- **Realistic Distribution** — Proper rarity slots, 12.5% mythic rare chance, foil distribution, and alt-art variants (showcase, borderless, extended art, full art)
- **Collector Boosters** — Premium packs with higher foil rates and alt-art focused slots
- **Animated Pack Opening** — 3D card flip animations with Framer Motion, confetti bursts for rare/mythic/foil pulls
- **Event Tagging** — Tag granted packs with event names; tags carry through to collection for easy filtering
- **Card Pool Editor** — Disable/enable individual cards per set to curate what appears in boosters
- **Custom Booster Maker** — Build custom booster templates using a simple DSL syntax with cross-set slot definitions
- **Collection Management** — Browse collected cards with rarity/color/set filters, click-to-enlarge with Scryfall links
- **Moxfield Export** — Export collections as Moxfield-compatible CSV or plain text, filterable by event tag
- **Full Backup & Restore** — Export/import entire database as JSON; per-player collection recovery
- **Docker Ready** — Single `docker compose up` deployment with persistent PostgreSQL volume
- **Role-Based Access** — Admin and Player roles with protected routes and middleware

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| UI Components | Shadcn/ui (Radix UI primitives) |
| Animations | Framer Motion, canvas-confetti |
| Routing | Wouter |
| State | TanStack React Query v5 |
| Backend | Express.js, TypeScript |
| Auth | Passport.js (local strategy), express-session |
| Database | PostgreSQL 16 |
| ORM | Drizzle ORM + drizzle-zod |
| Card Data | Scryfall API |
| Deployment | Docker + Docker Compose |

---

## Requirements

### Docker Setup (Recommended)
- Docker Engine 20+
- Docker Compose v2+

### Manual Setup
- Node.js 20+
- PostgreSQL 16+
- npm

---

## Installation

### Docker (Recommended)

1. **Clone the repository:**

```bash
git clone https://github.com/your-username/mtg-pack-simulator.git
cd mtg-pack-simulator
```

2. **Create your environment file:**

```bash
cp .env.example .env
```

3. **Edit `.env` with your settings:**

```env
POSTGRES_USER=mtg_user
POSTGRES_PASSWORD=your_strong_password_here
POSTGRES_DB=mtg_pack_sim
SESSION_SECRET=your_random_session_secret_here
APP_PORT=5000
```

4. **Build and start:**

```bash
docker compose up -d --build
```

5. **Access the app** at `http://localhost:5000` (or whatever port you set in `APP_PORT`).

> The database schema is automatically applied on first startup via `drizzle-kit push`.

#### Updating

To update to a newer version after pulling changes:

```bash
docker compose up -d --build
```

This rebuilds the app container while preserving all data in the PostgreSQL volume. **Your users, collections, and cards are safe.**

> **Warning:** Never use `docker compose down -v` unless you intentionally want to delete all data. The `-v` flag removes the database volume.

---

### Manual Setup

1. **Clone and install dependencies:**

```bash
git clone https://github.com/your-username/mtg-pack-simulator.git
cd mtg-pack-simulator
npm install
```

2. **Set up PostgreSQL** and create a database.

3. **Configure environment variables:**

```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/mtg_pack_sim"
export SESSION_SECRET="your_random_session_secret"
```

4. **Push the database schema:**

```bash
npm run db:push
```

5. **Start in development mode:**

```bash
npm run dev
```

6. **Or build and run for production:**

```bash
npm run build
npm run start
```

---

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_USER` | PostgreSQL username | `mtg_user` |
| `POSTGRES_PASSWORD` | PostgreSQL password | — |
| `POSTGRES_DB` | Database name | `mtg_pack_sim` |
| `SESSION_SECRET` | Secret for session encryption | — |
| `APP_PORT` | Port the app listens on | `5000` |
| `DATABASE_URL` | Full PostgreSQL connection string (manual setup only) | — |

---

## Usage Guide

### First Launch

On first launch, the database is empty. You need to create the first admin account:

1. Navigate to the login page
2. The first registered user with a valid invitation code becomes an admin — but first, an admin needs to exist to create invitation codes

**Bootstrap process:** The system seeds a default admin account on first run:
- Username: `admin`
- Password: `admin`

> **Change this password immediately** after first login via the User Management page.

---

### Admin Panel

Admins have access to all management modules through the navigation sidebar.

#### User Management

- **Create users** with username, password, and role (admin or player)
- **Generate invitation codes** that players use to self-register
- **Edit** existing users (change password, role)
- **Delete** users and view their pack history and collection

#### Set Management

- **Sync sets** from the Scryfall API by entering a set code (e.g., `woe` for Wilds of Eldraine, `neo` for Kamigawa: Neon Dynasty)
- View all synced sets with card counts and set icons
- The sync process fetches all cards in a set, respecting Scryfall's rate limits (100ms between requests)
- Sets are automatically marked as active once synced

#### Grant Packs

- Select a synced set, pack type (play booster, collector booster, or custom template), and target player
- **Grant multiple packs** at once by specifying a quantity
- **Tag packs** with an event name (e.g., "Friday Draft Night") — the tag carries through to opened cards in the collection
- View and manage all granted packs, including deleting unopened ones

#### Card Pool Editor

- Browse all cards in a synced set with visual previews
- **Disable/enable individual cards** — disabled cards are excluded from all booster generation
- Useful for removing unwanted promos, tokens, or specific printings from the card pool
- Filter cards by name to quickly find specific cards

#### Custom Booster Maker

- Create reusable booster templates using the **Booster DSL syntax**
- Name templates for easy reference (e.g., "Chaos Draft Pack", "Rare-Heavy Sealed")
- **Validate** templates before saving to catch syntax errors
- **Test generate** a sample pack against any synced set to preview results
- Templates can be selected as a pack type when granting packs
- See the [DSL Reference](#custom-booster-dsl-reference) section for syntax details

#### Backup & Restore

- **Full Database Export** — Download a complete JSON backup of all data: users (with hashed passwords), sets, cards, collections, packs, invitation codes, and booster templates
- **Full Database Import** — Restore from a backup file. This replaces ALL current data with a two-step confirmation to prevent accidents
- **Player Collection Export** — Download a specific player's collection as JSON
- **Player Collection Import** — Re-import a player's collection from a previously exported file (additive — merges with existing cards)

---

### Player Experience

#### Opening Packs

- View all available (unopened) packs in the pack inventory
- Click a pack to start the **animated opening experience**:
  - Cards are revealed one at a time with a 3D flip animation
  - **Foil cards** display a rainbow shimmer overlay and a "FOIL" badge
  - **Alt-art cards** show their type (Showcase, Borderless, Extended Art, Full Art)
  - **Rare, mythic rare, and foil pulls** trigger confetti effects
  - Click any revealed card to enlarge it; click again to open it on Scryfall
- Opened cards are automatically added to the player's collection with the pack's event tag

#### Collection Browser

- Browse all collected cards with filters:
  - **Rarity** (common, uncommon, rare, mythic)
  - **Color** (white, blue, black, red, green, colorless, multicolor)
  - **Set** (filter by any set you have cards from)
  - **Event tag** (filter by the event/tag the card was obtained from)
  - **Search** by card name
- Click any card to enlarge it with a link to its Scryfall page
- View card counts and foil status

#### Exporting Collections

- **Plain Text Export** — Export your collection as a text list (e.g., `1 Lightning Bolt (2X2) 224`)
- **Moxfield CSV Export** — Export in Moxfield-compatible CSV format for direct import into Moxfield decks/collections
- **Export by Tag** — Export only cards from a specific event/tag in either format
- **Language Preference** — Set your preferred language in settings

---

## Booster Distribution Rules

### Classic Booster (Pre-2024 Sets / Draft)
15 cards per pack:
- 1 Rare or Mythic Rare (12.5% mythic chance)
- 3 Uncommons
- 10 Commons
- 1 Basic Land
- ~25% chance one common is replaced by a foil of any rarity

### Modern Play Booster (2024+ Sets)
14 cards per pack:
- 6 Commons (normal art)
- 3 Uncommons (normal art)
- 1 Rare/Mythic (normal art, 12.5% mythic chance)
- 1 Wildcard (any rarity, 2.4% alt-art chance)
- 1 Guaranteed Foil (any rarity, 1.5% alt-art chance)
- 1 Land (20% chance of foil full-art land)
- 1 Extra Common

### Collector Booster
15 cards per pack:
- All slots prefer alt-art variants
- ~60% of cards are foil
- Includes extended art exclusive slot and showcase/borderless premium slot

### Alt-Art Classification
Cards are classified as alt-art based on Scryfall metadata:
- `borderColor === "borderless"`
- `fullArt === true`
- `frameEffects` includes `"showcase"` or `"extendedart"`

---

## Custom Booster DSL Reference

Custom booster templates use a simple domain-specific language to define slot distributions.

### Syntax

```
{slot1;slot2;slot3;...}
```

Each slot defines what rarity of card fills that position:

```
rarity,probability[,rarity2,probability2,...]
```

### Rarity Codes

| Code | Rarity |
|------|--------|
| `c` | Common |
| `u` | Uncommon |
| `r` | Rare |
| `m` | Mythic Rare |

### Rules
- Probabilities in each slot must sum to **100**
- Each slot produces exactly one card

### Examples

**Standard pack (1 R/M + 1 U + 3 C):**
```
{r,87.5,m,12.5;u,100;c,100;c,100;c,100}
```

**All-rare fun pack:**
```
{r,50,m,50;r,50,m,50;r,50,m,50;r,50,m,50;r,50,m,50}
```

**Cross-set slot** (pull from a specific set):
```
{neo:r,75,neo:m,25;u,100;c,100}
```
This pulls the rare/mythic slot specifically from the Kamigawa: Neon Dynasty (`neo`) set, regardless of which set the pack is generated for.

---

## API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register with invitation code |
| POST | `/api/auth/login` | Log in |
| POST | `/api/auth/logout` | Log out |
| GET | `/api/auth/me` | Get current session user |

### Admin — Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | List all users |
| POST | `/api/admin/users` | Create a user |
| PATCH | `/api/admin/users/:id` | Update a user |
| DELETE | `/api/admin/users/:id` | Delete a user |
| POST | `/api/admin/invitations` | Generate invitation codes |

### Admin — Sets & Cards
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/sets` | List synced sets |
| POST | `/api/admin/sets/sync` | Sync a set from Scryfall |
| GET | `/api/admin/sets/:code/cards` | List cards in a set |
| PATCH | `/api/admin/sets/:code/cards/:id/toggle` | Enable/disable a card |

### Admin — Packs & Tags
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/packs/grant` | Grant packs to a player |
| DELETE | `/api/admin/packs/:id` | Delete an unopened pack |
| GET | `/api/admin/tags` | List all event tags |
| DELETE | `/api/admin/tags/:tag` | Delete a tag |

### Admin — Custom Boosters
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/booster-templates` | List templates |
| POST | `/api/admin/booster-templates` | Create a template |
| PATCH | `/api/admin/booster-templates/:id` | Update a template |
| DELETE | `/api/admin/booster-templates/:id` | Delete a template |
| POST | `/api/admin/booster-templates/validate` | Validate DSL syntax |
| POST | `/api/admin/booster-templates/test-generate` | Test generate a pack |

### Admin — Backup
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/backup/export` | Export full database as JSON |
| POST | `/api/admin/backup/import` | Import full database from JSON |
| GET | `/api/admin/users/:id/collection/export` | Export a player's collection |
| POST | `/api/admin/users/:id/collection/import` | Import a player's collection |

### Player
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/player/packs` | List available packs |
| POST | `/api/player/packs/:id/open` | Open a pack |
| GET | `/api/player/collection` | Browse collection |
| GET | `/api/player/collection/tags` | List collection tags |
| GET | `/api/player/collection/export` | Export as text |
| GET | `/api/player/collection/export/csv` | Export as Moxfield CSV |
| GET | `/api/player/collection/export/tag/:tag` | Export by tag (text) |
| GET | `/api/player/collection/export/csv/tag/:tag` | Export by tag (CSV) |
| PATCH | `/api/player/preferences/language` | Update language preference |

---

## Project Structure

```
mtg-pack-simulator/
├── client/                  # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/      # Reusable UI components (nav, cards, etc.)
│   │   ├── hooks/           # Custom React hooks (auth, toast)
│   │   ├── lib/             # Utilities (query client, helpers)
│   │   └── pages/           # Page components
│   │       ├── login.tsx
│   │       ├── player-packs.tsx
│   │       ├── open-pack.tsx
│   │       ├── collection.tsx
│   │       ├── admin-users.tsx
│   │       ├── admin-sets.tsx
│   │       ├── admin-grant.tsx
│   │       ├── admin-card-pool.tsx
│   │       ├── admin-booster-maker.tsx
│   │       └── admin-backup.tsx
│   └── index.html
├── server/                  # Backend (Express)
│   ├── index.ts             # Server entry point
│   ├── routes.ts            # All API routes + auth setup
│   ├── storage.ts           # Database access layer (IStorage)
│   ├── db.ts                # Database connection (Drizzle + pg)
│   └── vite.ts              # Vite dev server integration
├── shared/                  # Shared between client & server
│   ├── schema.ts            # Drizzle ORM schema + Zod validation
│   └── routes.ts            # API route definitions
├── docker-compose.yml       # Docker Compose configuration
├── Dockerfile               # Multi-stage Docker build
├── .env.example             # Environment variable template
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── drizzle.config.ts
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

## Acknowledgments

- [Scryfall](https://scryfall.com/) for the comprehensive MTG card database and API
- [Wizards of the Coast](https://magic.wizards.com/) for Magic: The Gathering
- Card images are served from Scryfall's CDN and are property of Wizards of the Coast
