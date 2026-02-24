
import { pgTable, text, serial, integer, boolean, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", ["admin", "player"]);
export const packStatusEnum = pgEnum("pack_status", ["available", "opened"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: userRoleEnum("role").default("player").notNull(),
  preferredLanguage: text("preferred_language").default("en"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sets = pgTable("sets", {
  code: text("code").primaryKey(), // Scryfall set code
  name: text("name").notNull(),
  releaseDate: text("release_date"),
  iconSvgUri: text("icon_svg_uri"),
  cardCount: integer("card_count").notNull(),
  isActive: boolean("is_active").default(true),
});

export const cards = pgTable("cards", {
  id: text("id").primaryKey(), // Scryfall UUID
  oracleId: text("oracle_id"),
  code: text("code").notNull(), // Set code
  mtgoId: integer("mtgo_id"),
  name: text("name").notNull(),
  lang: text("lang").default("en"),
  uri: text("uri"),
  scryfallUri: text("scryfall_uri"),
  layout: text("layout"),
  highresImage: boolean("highres_image"),
  imageStatus: text("image_status"),
  imageUris: jsonb("image_uris"), // { small, normal, large, png, art_crop, border_crop }
  manaCost: text("mana_cost"),
  cmc: integer("cmc"), // Use number/float? Scryfall uses float. Using integer might lose .5 un-sets
  typeLine: text("type_line"),
  oracleText: text("oracle_text"),
  colors: jsonb("colors"), // Array of strings
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
  disabled: boolean("disabled").default(false),
});

export const packConfigs = pgTable("pack_configs", {
  id: serial("id").primaryKey(),
  setCode: text("set_code").notNull().references(() => sets.code),
  packType: text("pack_type").notNull(), // 'play', 'collector', 'set', 'draft'
  label: text("label").notNull(), // Display name
  description: text("description"),
  config: jsonb("config").notNull(), // The complex rules for generation
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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  packs: many(userPacks),
  collection: many(collection),
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

// Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertSetSchema = createInsertSchema(sets);
export const insertCardSchema = createInsertSchema(cards);
export const insertPackConfigSchema = createInsertSchema(packConfigs).omit({ id: true });
export const insertUserPackSchema = createInsertSchema(userPacks).omit({ id: true, openedAt: true, createdAt: true });
export const insertCollectionSchema = createInsertSchema(collection).omit({ id: true, addedAt: true });
export const insertBoosterTemplateSchema = createInsertSchema(boosterTemplates).omit({ id: true, createdAt: true });

// Types
export type User = typeof users.$inferSelect;
export type Set = typeof sets.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type PackConfig = typeof packConfigs.$inferSelect;
export type UserPack = typeof userPacks.$inferSelect;
export type CollectionItem = typeof collection.$inferSelect;
export type BoosterTemplate = typeof boosterTemplates.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertPackConfig = z.infer<typeof insertPackConfigSchema>;
export type InsertUserPack = z.infer<typeof insertUserPackSchema>;
export type InsertBoosterTemplate = z.infer<typeof insertBoosterTemplateSchema>;

export type UserRole = "admin" | "player";
