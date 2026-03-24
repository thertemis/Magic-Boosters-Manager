#!/usr/bin/env node
/**
 * Non-interactive database migration script for Docker deployments.
 * Uses direct SQL with IF NOT EXISTS guards — safe to run on every startup.
 * Never drops columns, tables, or data.
 */

const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run(sql, label) {
  try {
    await pool.query(sql);
    console.log(`[migrate] ✓ ${label}`);
  } catch (err) {
    // Only throw on unexpected errors
    if (err.code === "42P07" || err.code === "42701" || err.code === "42710") {
      // 42P07 = duplicate_table, 42701 = duplicate_column, 42710 = duplicate_object
      console.log(`[migrate] — ${label} (already exists, skipped)`);
    } else {
      console.error(`[migrate] ✗ ${label}: ${err.message}`);
      throw err;
    }
  }
}

async function migrate() {
  console.log("[migrate] Starting database migration...");

  // ── Enums ──────────────────────────────────────────────────────────────────
  await run(
    `DO $$ BEGIN
       CREATE TYPE user_role AS ENUM ('admin', 'player');
     EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    "enum user_role"
  );

  await run(
    `DO $$ BEGIN
       CREATE TYPE pack_status AS ENUM ('available', 'opened');
     EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    "enum pack_status"
  );

  // ── Core tables ────────────────────────────────────────────────────────────
  await run(
    `CREATE TABLE IF NOT EXISTS users (
       id               SERIAL PRIMARY KEY,
       username         TEXT NOT NULL UNIQUE,
       password         TEXT NOT NULL,
       role             user_role NOT NULL DEFAULT 'player',
       preferred_language TEXT DEFAULT 'en',
       discord_user_id  TEXT UNIQUE,
       created_at       TIMESTAMP DEFAULT NOW()
     );`,
    "table users"
  );

  await run(
    `CREATE TABLE IF NOT EXISTS sets (
       code        TEXT PRIMARY KEY,
       name        TEXT NOT NULL,
       release_date TEXT,
       icon_svg_uri TEXT,
       card_count  INTEGER NOT NULL,
       is_active   BOOLEAN DEFAULT TRUE
     );`,
    "table sets"
  );

  await run(
    `CREATE TABLE IF NOT EXISTS cards (
       id                TEXT PRIMARY KEY,
       oracle_id         TEXT,
       code              TEXT NOT NULL,
       mtgo_id           INTEGER,
       name              TEXT NOT NULL,
       lang              TEXT DEFAULT 'en',
       uri               TEXT,
       scryfall_uri      TEXT,
       layout            TEXT,
       highres_image     BOOLEAN,
       image_status      TEXT,
       image_uris        JSONB,
       mana_cost         TEXT,
       cmc               REAL,
       type_line         TEXT,
       oracle_text       TEXT,
       colors            JSONB,
       color_identity    JSONB,
       keywords          JSONB,
       legalities        JSONB,
       games             JSONB,
       reserved          BOOLEAN,
       foil              BOOLEAN,
       nonfoil           BOOLEAN,
       finishes          JSONB,
       oversized         BOOLEAN,
       promo             BOOLEAN,
       reprint           BOOLEAN,
       variation         BOOLEAN,
       set_id            TEXT,
       "set"             TEXT,
       set_name          TEXT,
       set_type          TEXT,
       set_uri           TEXT,
       set_search_uri    TEXT,
       scryfall_set_uri  TEXT,
       rulings_uri       TEXT,
       prints_search_uri TEXT,
       collector_number  TEXT,
       digital           BOOLEAN,
       rarity            TEXT,
       flavor_text       TEXT,
       card_back_id      TEXT,
       artist            TEXT,
       artist_ids        JSONB,
       illustration_id   TEXT,
       border_color      TEXT,
       frame             TEXT,
       full_art          BOOLEAN,
       textless          BOOLEAN,
       booster           BOOLEAN,
       story_spotlight   BOOLEAN,
       edhrec_rank       INTEGER,
       prices            JSONB,
       related_uris      JSONB,
       frame_effects     JSONB,
       promo_types       JSONB,
       card_faces        JSONB,
       power             TEXT,
       toughness         TEXT,
       loyalty           TEXT,
       produced_mana     JSONB,
       disabled          BOOLEAN DEFAULT FALSE
     );`,
    "table cards"
  );

  await run(
    `CREATE TABLE IF NOT EXISTS pack_configs (
       id        SERIAL PRIMARY KEY,
       set_code  TEXT NOT NULL REFERENCES sets(code),
       pack_type TEXT NOT NULL,
       label     TEXT NOT NULL,
       description TEXT,
       config    JSONB NOT NULL
     );`,
    "table pack_configs"
  );

  await run(
    `CREATE TABLE IF NOT EXISTS user_packs (
       id         SERIAL PRIMARY KEY,
       user_id    INTEGER NOT NULL REFERENCES users(id),
       set_code   TEXT NOT NULL REFERENCES sets(code),
       pack_type  TEXT NOT NULL,
       tag        TEXT,
       status     pack_status NOT NULL DEFAULT 'available',
       opened_at  TIMESTAMP,
       created_at TIMESTAMP DEFAULT NOW()
     );`,
    "table user_packs"
  );

  await run(
    `CREATE TABLE IF NOT EXISTS collection (
       id       SERIAL PRIMARY KEY,
       user_id  INTEGER NOT NULL REFERENCES users(id),
       card_id  TEXT NOT NULL REFERENCES cards(id),
       quantity INTEGER NOT NULL DEFAULT 1,
       is_foil  BOOLEAN DEFAULT FALSE,
       tag      TEXT,
       added_at TIMESTAMP DEFAULT NOW()
     );`,
    "table collection"
  );

  await run(
    `CREATE TABLE IF NOT EXISTS invitation_codes (
       id         SERIAL PRIMARY KEY,
       code       TEXT NOT NULL UNIQUE,
       is_used    BOOLEAN NOT NULL DEFAULT FALSE,
       created_at TIMESTAMP DEFAULT NOW()
     );`,
    "table invitation_codes"
  );

  await run(
    `CREATE TABLE IF NOT EXISTS booster_templates (
       id         SERIAL PRIMARY KEY,
       name       TEXT NOT NULL,
       definition TEXT NOT NULL,
       created_at TIMESTAMP DEFAULT NOW()
     );`,
    "table booster_templates"
  );

  // ── Economy tables ──────────────────────────────────────────────────────────
  await run(
    `CREATE TABLE IF NOT EXISTS economy_settings (
       id                      SERIAL PRIMARY KEY,
       currency_name           TEXT NOT NULL DEFAULT 'Gold',
       currency_symbol         TEXT NOT NULL DEFAULT 'G',
       economy_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
       marketplace_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
       pack_store_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
       user_trading_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
       card_sell_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
       daily_currency_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
       daily_currency_amount   INTEGER NOT NULL DEFAULT 100,
       sell_rate_multiplier    REAL NOT NULL DEFAULT 0.5,
       admin_timezone          TEXT NOT NULL DEFAULT 'UTC',
       updated_at              TIMESTAMP DEFAULT NOW()
     );`,
    "table economy_settings"
  );

  await run(
    `CREATE TABLE IF NOT EXISTS user_balances (
       user_id              INTEGER PRIMARY KEY REFERENCES users(id),
       balance              INTEGER NOT NULL DEFAULT 0,
       last_daily_claim_at  TIMESTAMP
     );`,
    "table user_balances"
  );

  await run(
    `CREATE TABLE IF NOT EXISTS currency_transactions (
       id          SERIAL PRIMARY KEY,
       user_id     INTEGER NOT NULL REFERENCES users(id),
       amount      INTEGER NOT NULL,
       type        TEXT NOT NULL,
       description TEXT,
       created_at  TIMESTAMP DEFAULT NOW()
     );`,
    "table currency_transactions"
  );

  await run(
    `CREATE TABLE IF NOT EXISTS market_pack_listings (
       id         SERIAL PRIMARY KEY,
       name       TEXT NOT NULL,
       description TEXT,
       set_code   TEXT NOT NULL REFERENCES sets(code),
       pack_type  TEXT NOT NULL,
       price      INTEGER NOT NULL,
       stock      INTEGER,
       is_active  BOOLEAN NOT NULL DEFAULT TRUE,
       created_at TIMESTAMP DEFAULT NOW()
     );`,
    "table market_pack_listings"
  );

  await run(
    `CREATE TABLE IF NOT EXISTS market_card_listings (
       id         SERIAL PRIMARY KEY,
       seller_id  INTEGER NOT NULL REFERENCES users(id),
       card_id    TEXT NOT NULL REFERENCES cards(id),
       is_foil    BOOLEAN NOT NULL DEFAULT FALSE,
       quantity   INTEGER NOT NULL DEFAULT 1,
       price      INTEGER NOT NULL,
       is_active  BOOLEAN NOT NULL DEFAULT TRUE,
       created_at TIMESTAMP DEFAULT NOW()
     );`,
    "table market_card_listings"
  );

  await run(
    `CREATE TABLE IF NOT EXISTS booster_schedules (
       id            SERIAL PRIMARY KEY,
       name          TEXT NOT NULL,
       user_id       INTEGER REFERENCES users(id),
       set_code      TEXT NOT NULL REFERENCES sets(code),
       pack_type     TEXT NOT NULL,
       tag           TEXT,
       quantity      INTEGER NOT NULL DEFAULT 1,
       schedule_hour INTEGER NOT NULL DEFAULT 8,
       is_active     BOOLEAN NOT NULL DEFAULT TRUE,
       last_run_at   TIMESTAMP,
       created_at    TIMESTAMP DEFAULT NOW()
     );`,
    "table booster_schedules"
  );

  await run(
    `CREATE TABLE IF NOT EXISTS api_keys (
       id           SERIAL PRIMARY KEY,
       name         TEXT NOT NULL,
       key          TEXT NOT NULL UNIQUE,
       created_by   INTEGER NOT NULL REFERENCES users(id),
       is_active    BOOLEAN NOT NULL DEFAULT TRUE,
       last_used_at TIMESTAMP,
       created_at   TIMESTAMP DEFAULT NOW()
     );`,
    "table api_keys"
  );

  await run(
    `CREATE TABLE IF NOT EXISTS app_settings (
       id          SERIAL PRIMARY KEY,
       app_name    TEXT DEFAULT 'MTG Pack Simulator',
       favicon_data TEXT,
       updated_at  TIMESTAMP DEFAULT NOW()
     );`,
    "table app_settings"
  );

  // ── Column additions for existing installations ────────────────────────────
  // These are safe no-ops if the column already exists.

  await run(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en';`,
    "users.preferred_language"
  );

  await run(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS discord_user_id TEXT;`,
    "users.discord_user_id"
  );

  await run(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();`,
    "users.created_at"
  );

  // Unique constraint on discord_user_id (safe: nullable column, NULLs don't conflict)
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_discord_user_id_unique'
      ) THEN
        ALTER TABLE users ADD CONSTRAINT users_discord_user_id_unique UNIQUE (discord_user_id);
      END IF;
    END $$;
  `);
  console.log("[migrate] ✓ users.discord_user_id unique constraint");

  await run(
    `ALTER TABLE collection ADD COLUMN IF NOT EXISTS tag TEXT;`,
    "collection.tag"
  );

  await run(
    `ALTER TABLE user_packs ADD COLUMN IF NOT EXISTS tag TEXT;`,
    "user_packs.tag"
  );

  await run(
    `ALTER TABLE cards ADD COLUMN IF NOT EXISTS frame_effects JSONB;`,
    "cards.frame_effects"
  );

  await run(
    `ALTER TABLE cards ADD COLUMN IF NOT EXISTS promo_types JSONB;`,
    "cards.promo_types"
  );

  await run(
    `ALTER TABLE cards ADD COLUMN IF NOT EXISTS card_faces JSONB;`,
    "cards.card_faces"
  );

  await run(
    `ALTER TABLE cards ADD COLUMN IF NOT EXISTS disabled BOOLEAN DEFAULT FALSE;`,
    "cards.disabled"
  );

  await run(
    `ALTER TABLE economy_settings ADD COLUMN IF NOT EXISTS sell_rate_multiplier REAL NOT NULL DEFAULT 0.5;`,
    "economy_settings.sell_rate_multiplier"
  );

  await run(
    `ALTER TABLE economy_settings ADD COLUMN IF NOT EXISTS admin_timezone TEXT NOT NULL DEFAULT 'UTC';`,
    "economy_settings.admin_timezone"
  );

  console.log("[migrate] Migration complete.");
  await pool.end();
}

migrate().catch((err) => {
  console.error("[migrate] Fatal error:", err.message);
  process.exit(1);
});
