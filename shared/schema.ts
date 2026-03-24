
import { pgTable, text, serial, integer, boolean, timestamp, jsonb, pgEnum, real } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", ["admin", "player"]);
export const packStatusEnum = pgEnum("pack_status", ["available", "opened"]);

export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  appName: text("app_name").default("MTG Pack Simulator"),
  faviconData: text("favicon_data"),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export type AppSettings = typeof appSettings.$inferSelect;
export const insertAppSettingsSchema = createInsertSchema(appSettings).omit({ id: true, updatedAt: true });
export type InsertAppSettings = z.infer<typeof insertAppSettingsSchema>;

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  key: text("key").notNull().unique(),
  createdBy: integer("created_by").notNull().references(() => users.id),
  isActive: boolean("is_active").default(true).notNull(),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: userRoleEnum("role").default("player").notNull(),
  preferredLanguage: text("preferred_language").default("en"),
  discordUserId: text("discord_user_id").unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sets = pgTable("sets", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  releaseDate: text("release_date"),
  iconSvgUri: text("icon_svg_uri"),
  cardCount: integer("card_count").notNull(),
  isActive: boolean("is_active").default(true),
});

export const cards = pgTable("cards", {
  id: text("id").primaryKey(),
  oracleId: text("oracle_id"),
  code: text("code").notNull(),
  mtgoId: integer("mtgo_id"),
  name: text("name").notNull(),
  lang: text("lang").default("en"),
  uri: text("uri"),
  scryfallUri: text("scryfall_uri"),
  layout: text("layout"),
  highresImage: boolean("highres_image"),
  imageStatus: text("image_status"),
  imageUris: jsonb("image_uris"),
  manaCost: text("mana_cost"),
  cmc: real("cmc"),
  typeLine: text("type_line"),
  oracleText: text("oracle_text"),
  colors: jsonb("colors"),
  colorIdentity: jsonb("color_identity"),
  keywords: jsonb("keywords"),
  legalities: jsonb("legalities"),
  games: jsonb("games"),
  reserved: boolean("reserved"),
  foil: boolean("foil"),
  nonfoil: boolean("nonfoil"),
  finishes: jsonb("finishes"),
  oversized: boolean("oversized"),
  promo: boolean("promo"),
  reprint: boolean("reprint"),
  variation: boolean("variation"),
  setId: text("set_id"),
  set: text("set"),
  setName: text("set_name"),
  setType: text("set_type"),
  setUri: text("set_uri"),
  setSearchUri: text("set_search_uri"),
  scryfallSetUri: text("scryfall_set_uri"),
  rulingsUri: text("rulings_uri"),
  printsSearchUri: text("prints_search_uri"),
  collectorNumber: text("collector_number"),
  digital: boolean("digital"),
  rarity: text("rarity"),
  flavorText: text("flavor_text"),
  cardBackId: text("card_back_id"),
  artist: text("artist"),
  artistIds: jsonb("artist_ids"),
  illustrationId: text("illustration_id"),
  borderColor: text("border_color"),
  frame: text("frame"),
  fullArt: boolean("full_art"),
  textless: boolean("textless"),
  booster: boolean("booster"),
  storySpotlight: boolean("story_spotlight"),
  edhrecRank: integer("edhrec_rank"),
  prices: jsonb("prices"),
  relatedUris: jsonb("related_uris"),
  frameEffects: jsonb("frame_effects"),
  promoTypes: jsonb("promo_types"),
  cardFaces: jsonb("card_faces"),
  power: text("power"),
  toughness: text("toughness"),
  loyalty: text("loyalty"),
  producedMana: jsonb("produced_mana"),
  disabled: boolean("disabled").default(false),
});

export const packConfigs = pgTable("pack_configs", {
  id: serial("id").primaryKey(),
  setCode: text("set_code").notNull().references(() => sets.code),
  packType: text("pack_type").notNull(),
  label: text("label").notNull(),
  description: text("description"),
  config: jsonb("config").notNull(),
});

export const userPacks = pgTable("user_packs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  setCode: text("set_code").notNull().references(() => sets.code),
  packType: text("pack_type").notNull(),
  tag: text("tag"),
  status: packStatusEnum("status").default("available").notNull(),
  openedAt: timestamp("opened_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const collection = pgTable("collection", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  cardId: text("card_id").notNull().references(() => cards.id),
  quantity: integer("quantity").default(1).notNull(),
  isFoil: boolean("is_foil").default(false),
  tag: text("tag"),
  addedAt: timestamp("added_at").defaultNow(),
});

export const invitationCodes = pgTable("invitation_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  isUsed: boolean("is_used").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const boosterTemplates = pgTable("booster_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  definition: text("definition").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Economy & Marketplace Tables

export const economySettings = pgTable("economy_settings", {
  id: serial("id").primaryKey(),
  currencyName: text("currency_name").default("Gold").notNull(),
  currencySymbol: text("currency_symbol").default("G").notNull(),
  economyEnabled: boolean("economy_enabled").default(false).notNull(),
  marketplaceEnabled: boolean("marketplace_enabled").default(true).notNull(),
  packStoreEnabled: boolean("pack_store_enabled").default(true).notNull(),
  userTradingEnabled: boolean("user_trading_enabled").default(true).notNull(),
  cardSellEnabled: boolean("card_sell_enabled").default(true).notNull(),
  dailyCurrencyEnabled: boolean("daily_currency_enabled").default(false).notNull(),
  dailyCurrencyAmount: integer("daily_currency_amount").default(100).notNull(),
  sellRateMultiplier: real("sell_rate_multiplier").default(0.5).notNull(),
  adminTimezone: text("admin_timezone").default("UTC").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userBalances = pgTable("user_balances", {
  userId: integer("user_id").primaryKey().references(() => users.id),
  balance: integer("balance").default(0).notNull(),
  lastDailyClaimAt: timestamp("last_daily_claim_at"),
});

export const currencyTransactions = pgTable("currency_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  amount: integer("amount").notNull(),
  type: text("type").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const marketPackListings = pgTable("market_pack_listings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  setCode: text("set_code").notNull().references(() => sets.code),
  packType: text("pack_type").notNull(),
  price: integer("price").notNull(),
  stock: integer("stock"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const marketCardListings = pgTable("market_card_listings", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").notNull().references(() => users.id),
  cardId: text("card_id").notNull().references(() => cards.id),
  isFoil: boolean("is_foil").default(false).notNull(),
  quantity: integer("quantity").default(1).notNull(),
  price: integer("price").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const boosterSchedules = pgTable("booster_schedules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  userId: integer("user_id").references(() => users.id),
  setCode: text("set_code").notNull().references(() => sets.code),
  packType: text("pack_type").notNull(),
  tag: text("tag"),
  quantity: integer("quantity").default(1).notNull(),
  scheduleHour: integer("schedule_hour").default(8).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastRunAt: timestamp("last_run_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  packs: many(userPacks),
  collection: many(collection),
  balance: one(userBalances, { fields: [users.id], references: [userBalances.userId] }),
  transactions: many(currencyTransactions),
  cardListings: many(marketCardListings, { relationName: "seller" }),
}));

export const setsRelations = relations(sets, ({ many }) => ({
  cards: many(cards),
  packConfigs: many(packConfigs),
}));

export const cardsRelations = relations(cards, ({ one }) => ({
  set: one(sets, {
    fields: [cards.code],
    references: [sets.code],
  }),
}));

export const userPacksRelations = relations(userPacks, ({ one }) => ({
  user: one(users, {
    fields: [userPacks.userId],
    references: [users.id],
  }),
  set: one(sets, {
    fields: [userPacks.setCode],
    references: [sets.code],
  }),
}));

export const collectionRelations = relations(collection, ({ one }) => ({
  user: one(users, {
    fields: [collection.userId],
    references: [users.id],
  }),
  card: one(cards, {
    fields: [collection.cardId],
    references: [cards.id],
  }),
}));

export const marketCardListingsRelations = relations(marketCardListings, ({ one }) => ({
  seller: one(users, { fields: [marketCardListings.sellerId], references: [users.id], relationName: "seller" }),
  card: one(cards, { fields: [marketCardListings.cardId], references: [cards.id] }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertSetSchema = createInsertSchema(sets);
export const insertCardSchema = createInsertSchema(cards);
export const insertPackConfigSchema = createInsertSchema(packConfigs).omit({ id: true });
export const insertUserPackSchema = createInsertSchema(userPacks).omit({ id: true, openedAt: true, createdAt: true });
export const insertCollectionSchema = createInsertSchema(collection).omit({ id: true, addedAt: true });
export const insertBoosterTemplateSchema = createInsertSchema(boosterTemplates).omit({ id: true, createdAt: true });
export const insertEconomySettingsSchema = createInsertSchema(economySettings).omit({ id: true, updatedAt: true });
export const insertMarketPackListingSchema = createInsertSchema(marketPackListings).omit({ id: true, createdAt: true });
export const insertMarketCardListingSchema = createInsertSchema(marketCardListings).omit({ id: true, createdAt: true });
export const insertBoosterScheduleSchema = createInsertSchema(boosterSchedules).omit({ id: true, lastRunAt: true, createdAt: true });

// Types
export type User = typeof users.$inferSelect;
export type Set = typeof sets.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type PackConfig = typeof packConfigs.$inferSelect;
export type UserPack = typeof userPacks.$inferSelect;
export type CollectionItem = typeof collection.$inferSelect;
export type BoosterTemplate = typeof boosterTemplates.$inferSelect;
export type EconomySettings = typeof economySettings.$inferSelect;
export type UserBalance = typeof userBalances.$inferSelect;
export type CurrencyTransaction = typeof currencyTransactions.$inferSelect;
export type MarketPackListing = typeof marketPackListings.$inferSelect;
export type MarketCardListing = typeof marketCardListings.$inferSelect;
export type BoosterSchedule = typeof boosterSchedules.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertPackConfig = z.infer<typeof insertPackConfigSchema>;
export type InsertUserPack = z.infer<typeof insertUserPackSchema>;
export type InsertBoosterTemplate = z.infer<typeof insertBoosterTemplateSchema>;
export type InsertEconomySettings = z.infer<typeof insertEconomySettingsSchema>;
export type InsertMarketPackListing = z.infer<typeof insertMarketPackListingSchema>;
export type InsertMarketCardListing = z.infer<typeof insertMarketCardListingSchema>;
export type InsertBoosterSchedule = z.infer<typeof insertBoosterScheduleSchema>;

export type ApiKey = typeof apiKeys.$inferSelect;
export const insertApiKeySchema = createInsertSchema(apiKeys).omit({ id: true, createdAt: true, lastUsedAt: true });
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;

export type UserRole = "admin" | "player";
