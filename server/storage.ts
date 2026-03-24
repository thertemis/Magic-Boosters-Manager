
import { db } from "./db";
import { eq, and, desc, sql, inArray, ne } from "drizzle-orm";
import {
  users, sets, cards, packConfigs, userPacks, collection, invitationCodes, boosterTemplates,
  economySettings, userBalances, currencyTransactions, marketPackListings, marketCardListings, boosterSchedules, apiKeys, appSettings,
  type User, type InsertUser, type Set, type Card, type PackConfig, type UserPack, type CollectionItem,
  type BoosterTemplate, type InsertBoosterTemplate,
  type EconomySettings, type InsertEconomySettings, type UserBalance, type CurrencyTransaction,
  type MarketPackListing, type InsertMarketPackListing, type MarketCardListing, type InsertMarketCardListing,
  type BoosterSchedule, type InsertBoosterSchedule, type ApiKey,
  type AppSettings, type InsertAppSettings,
} from "@shared/schema";

export interface IStorage {
  // User
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User>;
  deleteUser(id: number): Promise<void>;

  // Invitation Codes
  getInvitationCode(code: string): Promise<any | undefined>;
  useInvitationCode(code: string): Promise<void>;
  createInvitationCode(code: string): Promise<void>;

  // Sets & Cards
  getSet(code: string): Promise<Set | undefined>;
  createOrUpdateSet(set: Set): Promise<Set>;
  createOrUpdateCards(cardsList: Card[]): Promise<void>;
  getAllSets(): Promise<Set[]>;
  getCardsBySet(setCode: string): Promise<Card[]>;

  // Packs
  grantPack(userId: number, setCode: string, packType: string, tag?: string): Promise<UserPack>;
  getUserPacks(userId: number): Promise<(UserPack & { set: Set })[]>;
  getPack(packId: number): Promise<UserPack | undefined>;
  openPack(packId: number): Promise<void>;
  deletePack(packId: number): Promise<void>;

  // Collection
  addToCollection(userId: number, cardId: string, isFoil?: boolean, tag?: string): Promise<void>;
  getUserCollection(userId: number): Promise<(CollectionItem & { card: Card })[]>;
  getUserCollectionByTag(userId: number, tag: string): Promise<(CollectionItem & { card: Card })[]>;
  getUserTags(userId: number): Promise<string[]>;
  removeFromCollection(userId: number, cardId: string, isFoil: boolean, quantity: number): Promise<void>;

  // Card Pool Management
  toggleCardDisabled(cardId: string, disabled: boolean): Promise<void>;
  toggleCardsDisabled(cardIds: string[], disabled: boolean): Promise<void>;
  getCardsBySetWithDisabled(setCode: string): Promise<Card[]>;
  getEnabledCardsBySet(setCode: string): Promise<Card[]>;

  // Booster Templates
  getAllBoosterTemplates(): Promise<BoosterTemplate[]>;
  getBoosterTemplate(id: number): Promise<BoosterTemplate | undefined>;
  createBoosterTemplate(template: InsertBoosterTemplate): Promise<BoosterTemplate>;
  updateBoosterTemplate(id: number, updates: Partial<InsertBoosterTemplate>): Promise<BoosterTemplate>;
  deleteBoosterTemplate(id: number): Promise<void>;

  // User Preferences
  updateUserLanguage(userId: number, language: string): Promise<void>;

  // Admin Tag Management
  getAllTags(): Promise<string[]>;
  removeTag(tag: string): Promise<void>;

  // Economy Settings
  getEconomySettings(): Promise<EconomySettings | undefined>;
  upsertEconomySettings(settings: Partial<InsertEconomySettings>): Promise<EconomySettings>;

  // User Balances
  getUserBalance(userId: number): Promise<UserBalance>;
  adjustBalance(userId: number, amount: number, type: string, description?: string): Promise<UserBalance>;
  adminSetBalance(userId: number, newBalance: number): Promise<UserBalance>;
  claimDailyCurrency(userId: number, amount: number): Promise<UserBalance>;
  getAllUserBalances(): Promise<(UserBalance & { user: User })[]>;
  adminGrantCurrency(userId: number, amount: number, description?: string): Promise<void>;
  getUserTransactions(userId: number, limit?: number): Promise<CurrencyTransaction[]>;
  getAllTransactions(limit?: number): Promise<(CurrencyTransaction & { user: User })[]>;

  // Market Pack Listings (Admin)
  getAllMarketPackListings(): Promise<(MarketPackListing & { set: Set })[]>;
  getActiveMarketPackListings(): Promise<(MarketPackListing & { set: Set })[]>;
  getMarketPackListing(id: number): Promise<MarketPackListing | undefined>;
  createMarketPackListing(listing: InsertMarketPackListing): Promise<MarketPackListing>;
  updateMarketPackListing(id: number, updates: Partial<InsertMarketPackListing>): Promise<MarketPackListing>;
  deleteMarketPackListing(id: number): Promise<void>;
  buyPackFromStore(userId: number, listingId: number): Promise<UserPack>;

  // Market Card Listings (User-to-user)
  getActiveCardListings(): Promise<(MarketCardListing & { card: Card; seller: User })[]>;
  getUserCardListings(userId: number): Promise<(MarketCardListing & { card: Card })[]>;
  createCardListing(listing: InsertMarketCardListing): Promise<MarketCardListing>;
  cancelCardListing(listingId: number, userId: number): Promise<void>;
  buyCardListing(buyerId: number, listingId: number, quantity: number): Promise<void>;

  // Price refresh
  refreshCardPrices(): Promise<number>;

  // Booster Schedules
  getAllBoosterSchedules(): Promise<(BoosterSchedule & { set: Set; user: User | null })[]>;
  getActiveBoosterSchedules(): Promise<BoosterSchedule[]>;
  getBoosterSchedule(id: number): Promise<BoosterSchedule | undefined>;
  createBoosterSchedule(schedule: InsertBoosterSchedule): Promise<BoosterSchedule>;
  updateBoosterSchedule(id: number, updates: Partial<InsertBoosterSchedule>): Promise<BoosterSchedule>;
  deleteBoosterSchedule(id: number): Promise<void>;
  markScheduleRan(id: number): Promise<void>;

  // Full Backup / Restore
  getAllUsers(): Promise<User[]>;
  getUserByDiscordId(discordId: string): Promise<User | undefined>;
  setDiscordUserId(userId: number, discordId: string | null): Promise<User>;
  getAllCards(): Promise<Card[]>;
  getAllPackConfigs(): Promise<PackConfig[]>;
  getAllUserPacks(): Promise<UserPack[]>;
  getAllCollectionItems(): Promise<CollectionItem[]>;
  getAllInvitationCodes(): Promise<any[]>;
  bulkImportUsers(data: any[]): Promise<Map<number, number>>;
  bulkImportSets(data: any[]): Promise<void>;
  bulkImportCards(data: Card[]): Promise<void>;
  bulkImportPackConfigs(data: any[]): Promise<void>;
  bulkImportUserPacks(data: any[], userIdMap: Map<number, number>): Promise<void>;
  bulkImportCollection(data: any[], userIdMap: Map<number, number>): Promise<void>;
  bulkImportInvitationCodes(data: any[]): Promise<void>;
  bulkImportBoosterTemplates(data: any[]): Promise<void>;
  clearAllData(): Promise<void>;
  importPlayerCollection(userId: number, items: { cardId: string; quantity: number; isFoil: boolean; tag?: string }[]): Promise<number>;

  // API Keys
  getAllApiKeys(): Promise<ApiKey[]>;
  getApiKeyByKey(key: string): Promise<ApiKey | undefined>;
  createApiKey(name: string, createdBy: number): Promise<ApiKey>;
  revokeApiKey(id: number): Promise<void>;
  deleteApiKey(id: number): Promise<void>;
  touchApiKeyUsed(id: number): Promise<void>;

  // App Settings
  getAppSettings(): Promise<AppSettings>;
  upsertAppSettings(settings: Partial<InsertAppSettings>): Promise<AppSettings>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.username);
  }

  async getUserByDiscordId(discordId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.discordUserId, discordId));
    return user;
  }

  async setDiscordUserId(userId: number, discordId: string | null): Promise<User> {
    const [user] = await db.update(users).set({ discordUserId: discordId }).where(eq(users.id, userId)).returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(marketCardListings).where(eq(marketCardListings.sellerId, id));
    await db.delete(currencyTransactions).where(eq(currencyTransactions.userId, id));
    await db.delete(userBalances).where(eq(userBalances.userId, id));
    await db.delete(collection).where(eq(collection.userId, id));
    await db.delete(userPacks).where(eq(userPacks.userId, id));
    await db.delete(users).where(eq(users.id, id));
  }

  async getInvitationCode(code: string): Promise<any | undefined> {
    const [invitation] = await db.select().from(invitationCodes).where(and(eq(invitationCodes.code, code), eq(invitationCodes.isUsed, false)));
    return invitation;
  }

  async useInvitationCode(code: string): Promise<void> {
    await db.update(invitationCodes).set({ isUsed: true }).where(eq(invitationCodes.code, code));
  }

  async createInvitationCode(code: string): Promise<void> {
    await db.insert(invitationCodes).values({ code });
  }

  async getSet(code: string): Promise<Set | undefined> {
    const [set] = await db.select().from(sets).where(eq(sets.code, code));
    return set;
  }

  async createOrUpdateSet(set: Set): Promise<Set> {
    const [existing] = await db.select().from(sets).where(eq(sets.code, set.code));
    if (existing) {
      const [updated] = await db.update(sets).set(set).where(eq(sets.code, set.code)).returning();
      return updated;
    }
    const [created] = await db.insert(sets).values(set).returning();
    return created;
  }

  async createOrUpdateCards(cardsList: Card[]): Promise<void> {
    const batchSize = 100;
    for (let i = 0; i < cardsList.length; i += batchSize) {
      const batch = cardsList.slice(i, i + batchSize);
      await db.insert(cards).values(batch)
        .onConflictDoUpdate({
          target: cards.id,
          set: {
            name: sql`excluded.name`,
            imageUris: sql`excluded.image_uris`,
            prices: sql`excluded.prices`,
            rarity: sql`excluded.rarity`,
            typeLine: sql`excluded.type_line`,
            oracleText: sql`excluded.oracle_text`,
            colors: sql`excluded.colors`,
            colorIdentity: sql`excluded.color_identity`,
            keywords: sql`excluded.keywords`,
            manaCost: sql`excluded.mana_cost`,
            cmc: sql`excluded.cmc`,
            power: sql`excluded.power`,
            toughness: sql`excluded.toughness`,
            loyalty: sql`excluded.loyalty`,
            frameEffects: sql`excluded.frame_effects`,
            promoTypes: sql`excluded.promo_types`,
            fullArt: sql`excluded.full_art`,
            borderColor: sql`excluded.border_color`,
          }
        });
    }
  }

  async getAllSets(): Promise<Set[]> {
    return await db.select().from(sets).orderBy(desc(sets.releaseDate));
  }

  async getCardsBySet(setCode: string): Promise<Card[]> {
    return await db.select().from(cards).where(eq(cards.code, setCode));
  }

  async grantPack(userId: number, setCode: string, packType: string, tag?: string): Promise<UserPack> {
    const [pack] = await db.insert(userPacks).values({
      userId,
      setCode,
      packType,
      tag: tag || null,
      status: "available",
    }).returning();
    return pack;
  }

  async getUserPacks(userId: number): Promise<(UserPack & { set: Set })[]> {
    const packs = await db.select({
      id: userPacks.id,
      userId: userPacks.userId,
      setCode: userPacks.setCode,
      packType: userPacks.packType,
      tag: userPacks.tag,
      status: userPacks.status,
      openedAt: userPacks.openedAt,
      createdAt: userPacks.createdAt,
      set: sets,
    })
    .from(userPacks)
    .innerJoin(sets, eq(userPacks.setCode, sets.code))
    .where(eq(userPacks.userId, userId));
    return packs;
  }

  async getPack(packId: number): Promise<UserPack | undefined> {
    const [pack] = await db.select().from(userPacks).where(eq(userPacks.id, packId));
    return pack;
  }

  async openPack(packId: number): Promise<void> {
    await db.update(userPacks)
      .set({ status: "opened", openedAt: new Date() })
      .where(eq(userPacks.id, packId));
  }

  async deletePack(packId: number): Promise<void> {
    await db.delete(userPacks).where(eq(userPacks.id, packId));
  }

  async addToCollection(userId: number, cardId: string, isFoil: boolean = false, tag?: string): Promise<void> {
    const conditions = [
      eq(collection.userId, userId),
      eq(collection.cardId, cardId),
      eq(collection.isFoil, isFoil),
    ];
    if (tag) {
      conditions.push(eq(collection.tag, tag));
    } else {
      conditions.push(sql`${collection.tag} IS NULL`);
    }

    const [existing] = await db.select().from(collection).where(and(...conditions));

    if (existing) {
      await db.update(collection)
        .set({ quantity: existing.quantity + 1 })
        .where(eq(collection.id, existing.id));
    } else {
      await db.insert(collection).values({ userId, cardId, quantity: 1, isFoil, tag: tag || null });
    }
  }

  async getUserCollection(userId: number): Promise<(CollectionItem & { card: Card })[]> {
    return await db.select({
      id: collection.id,
      userId: collection.userId,
      cardId: collection.cardId,
      quantity: collection.quantity,
      isFoil: collection.isFoil,
      tag: collection.tag,
      addedAt: collection.addedAt,
      card: cards,
    })
    .from(collection)
    .innerJoin(cards, eq(collection.cardId, cards.id))
    .where(eq(collection.userId, userId));
  }

  async getUserCollectionByTag(userId: number, tag: string): Promise<(CollectionItem & { card: Card })[]> {
    return await db.select({
      id: collection.id,
      userId: collection.userId,
      cardId: collection.cardId,
      quantity: collection.quantity,
      isFoil: collection.isFoil,
      tag: collection.tag,
      addedAt: collection.addedAt,
      card: cards,
    })
    .from(collection)
    .innerJoin(cards, eq(collection.cardId, cards.id))
    .where(and(eq(collection.userId, userId), eq(collection.tag, tag)));
  }

  async getUserTags(userId: number): Promise<string[]> {
    const results = await db.selectDistinct({ tag: collection.tag })
      .from(collection)
      .where(and(eq(collection.userId, userId), sql`${collection.tag} IS NOT NULL`));
    return results.map(r => r.tag!).filter(Boolean);
  }

  async removeFromCollection(userId: number, cardId: string, isFoil: boolean, quantity: number): Promise<void> {
    const [existing] = await db.select().from(collection).where(
      and(eq(collection.userId, userId), eq(collection.cardId, cardId), eq(collection.isFoil, isFoil))
    );
    if (!existing) return;
    const newQty = existing.quantity - quantity;
    if (newQty <= 0) {
      await db.delete(collection).where(eq(collection.id, existing.id));
    } else {
      await db.update(collection).set({ quantity: newQty }).where(eq(collection.id, existing.id));
    }
  }

  async getAllTags(): Promise<string[]> {
    const packTags = await db.selectDistinct({ tag: userPacks.tag })
      .from(userPacks)
      .where(sql`${userPacks.tag} IS NOT NULL`);
    const collectionTags = await db.selectDistinct({ tag: collection.tag })
      .from(collection)
      .where(sql`${collection.tag} IS NOT NULL`);
    const allTags = new Set([
      ...packTags.map(r => r.tag!).filter(Boolean),
      ...collectionTags.map(r => r.tag!).filter(Boolean),
    ]);
    return Array.from(allTags).sort();
  }

  async removeTag(tag: string): Promise<void> {
    await db.update(userPacks).set({ tag: null }).where(eq(userPacks.tag, tag));
    await db.update(collection).set({ tag: null }).where(eq(collection.tag, tag));
  }

  async toggleCardDisabled(cardId: string, disabled: boolean): Promise<void> {
    await db.update(cards).set({ disabled }).where(eq(cards.id, cardId));
  }

  async toggleCardsDisabled(cardIds: string[], disabled: boolean): Promise<void> {
    if (cardIds.length === 0) return;
    await db.update(cards).set({ disabled }).where(inArray(cards.id, cardIds));
  }

  async getCardsBySetWithDisabled(setCode: string): Promise<Card[]> {
    return await db.select().from(cards).where(eq(cards.code, setCode));
  }

  async getEnabledCardsBySet(setCode: string): Promise<Card[]> {
    return await db.select().from(cards)
      .where(and(eq(cards.code, setCode), sql`(${cards.disabled} IS NULL OR ${cards.disabled} = false)`));
  }

  async getAllBoosterTemplates(): Promise<BoosterTemplate[]> {
    return await db.select().from(boosterTemplates).orderBy(desc(boosterTemplates.createdAt));
  }

  async getBoosterTemplate(id: number): Promise<BoosterTemplate | undefined> {
    const [template] = await db.select().from(boosterTemplates).where(eq(boosterTemplates.id, id));
    return template;
  }

  async createBoosterTemplate(template: InsertBoosterTemplate): Promise<BoosterTemplate> {
    const [created] = await db.insert(boosterTemplates).values(template).returning();
    return created;
  }

  async updateBoosterTemplate(id: number, updates: Partial<InsertBoosterTemplate>): Promise<BoosterTemplate> {
    const [updated] = await db.update(boosterTemplates).set(updates).where(eq(boosterTemplates.id, id)).returning();
    return updated;
  }

  async deleteBoosterTemplate(id: number): Promise<void> {
    await db.delete(boosterTemplates).where(eq(boosterTemplates.id, id));
  }

  async updateUserLanguage(userId: number, language: string): Promise<void> {
    await db.update(users).set({ preferredLanguage: language }).where(eq(users.id, userId));
  }

  // ---- Economy Settings ----

  async getEconomySettings(): Promise<EconomySettings | undefined> {
    const [settings] = await db.select().from(economySettings).limit(1);
    return settings;
  }

  async upsertEconomySettings(settings: Partial<InsertEconomySettings>): Promise<EconomySettings> {
    const existing = await this.getEconomySettings();
    if (existing) {
      const [updated] = await db.update(economySettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(economySettings.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(economySettings).values({
      currencyName: "Gold",
      currencySymbol: "G",
      economyEnabled: false,
      marketplaceEnabled: true,
      packStoreEnabled: true,
      userTradingEnabled: true,
      cardSellEnabled: true,
      dailyCurrencyEnabled: false,
      dailyCurrencyAmount: 100,
      sellRateMultiplier: 0.5,
      ...settings,
    }).returning();
    return created;
  }

  // ---- User Balances ----

  async getUserBalance(userId: number): Promise<UserBalance> {
    const [bal] = await db.select().from(userBalances).where(eq(userBalances.userId, userId));
    if (bal) return bal;
    const [created] = await db.insert(userBalances).values({ userId, balance: 0 }).returning();
    return created;
  }

  async adjustBalance(userId: number, amount: number, type: string, description?: string): Promise<UserBalance> {
    const bal = await this.getUserBalance(userId);
    const newBalance = Math.max(0, bal.balance + amount);
    await db.update(userBalances).set({ balance: newBalance }).where(eq(userBalances.userId, userId));
    await db.insert(currencyTransactions).values({ userId, amount, type, description: description || null });
    const [updated] = await db.select().from(userBalances).where(eq(userBalances.userId, userId));
    return updated;
  }

  async claimDailyCurrency(userId: number, amount: number): Promise<UserBalance> {
    await db.update(userBalances).set({ lastDailyClaimAt: new Date() }).where(eq(userBalances.userId, userId));
    return this.adjustBalance(userId, amount, "daily_grant", "Daily currency claim");
  }

  async getAllUserBalances(): Promise<(UserBalance & { user: User })[]> {
    const allPlayers = await db.select().from(users).orderBy(users.username);
    const balances = await db.select().from(userBalances);
    const balMap = new Map(balances.map(b => [b.userId, b]));
    return allPlayers.map(u => {
      const b = balMap.get(u.id);
      return { id: b?.id ?? 0, userId: u.id, balance: b?.balance ?? 0, lastDailyClaimAt: b?.lastDailyClaimAt ?? null, user: u } as UserBalance & { user: User };
    });
  }

  async adminGrantCurrency(userId: number, amount: number, description?: string): Promise<void> {
    await this.adjustBalance(userId, amount, "admin_grant", description || "Admin grant");
  }

  async adminSetBalance(userId: number, newBalance: number): Promise<UserBalance> {
    const bal = await this.getUserBalance(userId);
    const diff = newBalance - bal.balance;
    await db.update(userBalances).set({ balance: newBalance }).where(eq(userBalances.userId, userId));
    await db.insert(currencyTransactions).values({ userId, amount: diff, type: "admin_set", description: `Balance set to ${newBalance}` });
    const [updated] = await db.select().from(userBalances).where(eq(userBalances.userId, userId));
    return updated;
  }

  async getUserTransactions(userId: number, limit = 50): Promise<CurrencyTransaction[]> {
    return await db.select().from(currencyTransactions)
      .where(eq(currencyTransactions.userId, userId))
      .orderBy(desc(currencyTransactions.createdAt))
      .limit(limit);
  }

  async getAllTransactions(limit = 100): Promise<(CurrencyTransaction & { user: User })[]> {
    return await db.select({
      id: currencyTransactions.id,
      userId: currencyTransactions.userId,
      amount: currencyTransactions.amount,
      type: currencyTransactions.type,
      description: currencyTransactions.description,
      createdAt: currencyTransactions.createdAt,
      user: users,
    }).from(currencyTransactions)
      .innerJoin(users, eq(currencyTransactions.userId, users.id))
      .orderBy(desc(currencyTransactions.createdAt))
      .limit(limit);
  }

  // ---- Market Pack Listings ----

  async getAllMarketPackListings(): Promise<(MarketPackListing & { set: Set })[]> {
    return await db.select({
      id: marketPackListings.id,
      name: marketPackListings.name,
      description: marketPackListings.description,
      setCode: marketPackListings.setCode,
      packType: marketPackListings.packType,
      price: marketPackListings.price,
      stock: marketPackListings.stock,
      isActive: marketPackListings.isActive,
      createdAt: marketPackListings.createdAt,
      set: sets,
    }).from(marketPackListings).innerJoin(sets, eq(marketPackListings.setCode, sets.code))
      .orderBy(desc(marketPackListings.createdAt));
  }

  async getActiveMarketPackListings(): Promise<(MarketPackListing & { set: Set })[]> {
    return await db.select({
      id: marketPackListings.id,
      name: marketPackListings.name,
      description: marketPackListings.description,
      setCode: marketPackListings.setCode,
      packType: marketPackListings.packType,
      price: marketPackListings.price,
      stock: marketPackListings.stock,
      isActive: marketPackListings.isActive,
      createdAt: marketPackListings.createdAt,
      set: sets,
    }).from(marketPackListings).innerJoin(sets, eq(marketPackListings.setCode, sets.code))
      .where(eq(marketPackListings.isActive, true))
      .orderBy(marketPackListings.price);
  }

  async getMarketPackListing(id: number): Promise<MarketPackListing | undefined> {
    const [listing] = await db.select().from(marketPackListings).where(eq(marketPackListings.id, id));
    return listing;
  }

  async createMarketPackListing(listing: InsertMarketPackListing): Promise<MarketPackListing> {
    const [created] = await db.insert(marketPackListings).values(listing).returning();
    return created;
  }

  async updateMarketPackListing(id: number, updates: Partial<InsertMarketPackListing>): Promise<MarketPackListing> {
    const [updated] = await db.update(marketPackListings).set(updates).where(eq(marketPackListings.id, id)).returning();
    return updated;
  }

  async deleteMarketPackListing(id: number): Promise<void> {
    await db.delete(marketPackListings).where(eq(marketPackListings.id, id));
  }

  async buyPackFromStore(userId: number, listingId: number): Promise<UserPack> {
    const [listing] = await db.select().from(marketPackListings).where(eq(marketPackListings.id, listingId));
    if (!listing || !listing.isActive) throw new Error("Listing not available");

    const bal = await this.getUserBalance(userId);
    if (bal.balance < listing.price) throw new Error("Insufficient balance");

    await this.adjustBalance(userId, -listing.price, "pack_purchase", `Bought pack: ${listing.name}`);

    if (listing.stock !== null) {
      const newStock = listing.stock - 1;
      if (newStock <= 0) {
        await db.update(marketPackListings).set({ stock: newStock, isActive: false }).where(eq(marketPackListings.id, listingId));
      } else {
        await db.update(marketPackListings).set({ stock: newStock }).where(eq(marketPackListings.id, listingId));
      }
    }

    return this.grantPack(userId, listing.setCode, listing.packType, "marketplace");
  }

  // ---- Market Card Listings ----

  async getActiveCardListings(): Promise<(MarketCardListing & { card: Card; seller: User })[]> {
    return await db.select({
      id: marketCardListings.id,
      sellerId: marketCardListings.sellerId,
      cardId: marketCardListings.cardId,
      isFoil: marketCardListings.isFoil,
      quantity: marketCardListings.quantity,
      price: marketCardListings.price,
      isActive: marketCardListings.isActive,
      createdAt: marketCardListings.createdAt,
      card: cards,
      seller: users,
    }).from(marketCardListings)
      .innerJoin(cards, eq(marketCardListings.cardId, cards.id))
      .innerJoin(users, eq(marketCardListings.sellerId, users.id))
      .where(eq(marketCardListings.isActive, true))
      .orderBy(marketCardListings.price);
  }

  async getUserCardListings(userId: number): Promise<(MarketCardListing & { card: Card })[]> {
    return await db.select({
      id: marketCardListings.id,
      sellerId: marketCardListings.sellerId,
      cardId: marketCardListings.cardId,
      isFoil: marketCardListings.isFoil,
      quantity: marketCardListings.quantity,
      price: marketCardListings.price,
      isActive: marketCardListings.isActive,
      createdAt: marketCardListings.createdAt,
      card: cards,
    }).from(marketCardListings)
      .innerJoin(cards, eq(marketCardListings.cardId, cards.id))
      .where(and(eq(marketCardListings.sellerId, userId), eq(marketCardListings.isActive, true)))
      .orderBy(desc(marketCardListings.createdAt));
  }

  async refreshCardPrices(): Promise<number> {
    const allCards = await db.select({ id: cards.id }).from(cards);
    const batchSize = 75;
    let updated = 0;

    for (let i = 0; i < allCards.length; i += batchSize) {
      const batch = allCards.slice(i, i + batchSize);
      const identifiers = batch.map(c => ({ id: c.id }));

      try {
        const resp = await fetch("https://api.scryfall.com/cards/collection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifiers }),
        });
        if (!resp.ok) continue;
        const data = await resp.json() as { data: Array<{ id: string; prices: Record<string, string | null> }> };

        for (const card of data.data) {
          const p = card.prices || {};
          const bestPrices: Record<string, string | null> = { ...p };

          const usdVal = parseFloat(p.usd || "0");
          if (usdVal === 0) {
            const usdFoilVal = parseFloat(p.usd_foil || "0");
            if (usdFoilVal > 0) bestPrices.usd = p.usd_foil;
            else {
              const eurVal = parseFloat(p.eur || "0");
              if (eurVal > 0) bestPrices.usd = (eurVal * 1.1).toFixed(2);
              else {
                const tixVal = parseFloat(p.tix || "0");
                if (tixVal > 0) bestPrices.usd = (tixVal * 0.25).toFixed(2);
              }
            }
          }

          await db.update(cards).set({ prices: bestPrices }).where(eq(cards.id, card.id));
          updated++;
        }

        await new Promise(r => setTimeout(r, 100));
      } catch {
        continue;
      }
    }

    return updated;
  }

  async createCardListing(listing: InsertMarketCardListing): Promise<MarketCardListing> {
    const [created] = await db.insert(marketCardListings).values(listing).returning();
    return created;
  }

  async cancelCardListing(listingId: number, userId: number): Promise<void> {
    const [listing] = await db.select().from(marketCardListings)
      .where(and(eq(marketCardListings.id, listingId), eq(marketCardListings.sellerId, userId)));
    if (!listing) throw new Error("Listing not found");
    await db.update(marketCardListings).set({ isActive: false }).where(eq(marketCardListings.id, listingId));
    await this.addToCollection(userId, listing.cardId, listing.isFoil);
  }

  async buyCardListing(buyerId: number, listingId: number, quantity: number): Promise<void> {
    const [listing] = await db.select().from(marketCardListings)
      .where(and(eq(marketCardListings.id, listingId), eq(marketCardListings.isActive, true)));
    if (!listing) throw new Error("Listing not found or inactive");
    if (listing.sellerId === buyerId) throw new Error("Cannot buy your own listing");
    if (quantity > listing.quantity) throw new Error("Not enough stock");

    const totalCost = listing.price * quantity;
    const buyerBal = await this.getUserBalance(buyerId);
    if (buyerBal.balance < totalCost) throw new Error("Insufficient balance");

    await this.adjustBalance(buyerId, -totalCost, "card_purchase", `Bought ${quantity}x ${listing.cardId}`);
    await this.adjustBalance(listing.sellerId, totalCost, "listing_sale", `Sold ${quantity}x ${listing.cardId}`);

    for (let i = 0; i < quantity; i++) {
      await this.addToCollection(buyerId, listing.cardId, listing.isFoil);
    }

    const remaining = listing.quantity - quantity;
    if (remaining <= 0) {
      await db.update(marketCardListings).set({ isActive: false, quantity: 0 }).where(eq(marketCardListings.id, listingId));
    } else {
      await db.update(marketCardListings).set({ quantity: remaining }).where(eq(marketCardListings.id, listingId));
    }
  }

  // ---- Booster Schedules ----

  async getAllBoosterSchedules(): Promise<(BoosterSchedule & { set: Set; user: User | null })[]> {
    const results = await db.select({
      id: boosterSchedules.id,
      name: boosterSchedules.name,
      userId: boosterSchedules.userId,
      setCode: boosterSchedules.setCode,
      packType: boosterSchedules.packType,
      tag: boosterSchedules.tag,
      quantity: boosterSchedules.quantity,
      scheduleHour: boosterSchedules.scheduleHour,
      isActive: boosterSchedules.isActive,
      lastRunAt: boosterSchedules.lastRunAt,
      createdAt: boosterSchedules.createdAt,
      set: sets,
      user: users,
    }).from(boosterSchedules)
      .innerJoin(sets, eq(boosterSchedules.setCode, sets.code))
      .leftJoin(users, eq(boosterSchedules.userId, users.id))
      .orderBy(desc(boosterSchedules.createdAt));
    return results as any;
  }

  async getActiveBoosterSchedules(): Promise<BoosterSchedule[]> {
    return await db.select().from(boosterSchedules).where(eq(boosterSchedules.isActive, true));
  }

  async getBoosterSchedule(id: number): Promise<BoosterSchedule | undefined> {
    const [schedule] = await db.select().from(boosterSchedules).where(eq(boosterSchedules.id, id));
    return schedule;
  }

  async createBoosterSchedule(schedule: InsertBoosterSchedule): Promise<BoosterSchedule> {
    const [created] = await db.insert(boosterSchedules).values(schedule).returning();
    return created;
  }

  async updateBoosterSchedule(id: number, updates: Partial<InsertBoosterSchedule>): Promise<BoosterSchedule> {
    const [updated] = await db.update(boosterSchedules).set(updates).where(eq(boosterSchedules.id, id)).returning();
    return updated;
  }

  async deleteBoosterSchedule(id: number): Promise<void> {
    await db.delete(boosterSchedules).where(eq(boosterSchedules.id, id));
  }

  async markScheduleRan(id: number): Promise<void> {
    await db.update(boosterSchedules).set({ lastRunAt: new Date() }).where(eq(boosterSchedules.id, id));
  }

  // ---- Backup / Restore ----

  async getAllCards(): Promise<Card[]> {
    return await db.select().from(cards);
  }

  async getAllPackConfigs(): Promise<PackConfig[]> {
    return await db.select().from(packConfigs);
  }

  async getAllUserPacks(): Promise<UserPack[]> {
    return await db.select().from(userPacks);
  }

  async getAllCollectionItems(): Promise<CollectionItem[]> {
    return await db.select().from(collection);
  }

  async getAllInvitationCodes(): Promise<any[]> {
    return await db.select().from(invitationCodes);
  }

  async clearAllData(): Promise<void> {
    await db.delete(marketCardListings);
    await db.delete(marketPackListings);
    await db.delete(boosterSchedules);
    await db.delete(currencyTransactions);
    await db.delete(userBalances);
    await db.delete(economySettings);
    await db.delete(collection);
    await db.delete(userPacks);
    await db.delete(packConfigs);
    await db.delete(cards);
    await db.delete(sets);
    await db.delete(boosterTemplates);
    await db.delete(invitationCodes);
    await db.delete(users);
  }

  async bulkImportUsers(data: any[]): Promise<Map<number, number>> {
    const idMap = new Map<number, number>();
    for (const u of data) {
      const oldId = u.id;
      const [created] = await db.insert(users).values({
        username: u.username,
        password: u.password,
        role: u.role,
        preferredLanguage: u.preferredLanguage || "en",
      }).returning();
      idMap.set(oldId, created.id);
    }
    return idMap;
  }

  async bulkImportSets(data: any[]): Promise<void> {
    for (const s of data) {
      await db.insert(sets).values(s).onConflictDoUpdate({
        target: sets.code,
        set: { name: sql`excluded.name`, releaseDate: sql`excluded.release_date`, iconSvgUri: sql`excluded.icon_svg_uri`, cardCount: sql`excluded.card_count`, isActive: sql`excluded.is_active` },
      });
    }
  }

  async bulkImportCards(data: Card[]): Promise<void> {
    const batchSize = 100;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      await db.insert(cards).values(batch).onConflictDoUpdate({
        target: cards.id,
        set: {
          name: sql`excluded.name`,
          imageUris: sql`excluded.image_uris`,
          rarity: sql`excluded.rarity`,
          disabled: sql`excluded.disabled`,
        },
      });
    }
  }

  async bulkImportPackConfigs(data: any[]): Promise<void> {
    for (const pc of data) {
      await db.insert(packConfigs).values({
        setCode: pc.setCode,
        packType: pc.packType,
        label: pc.label,
        description: pc.description,
        config: pc.config,
      });
    }
  }

  async bulkImportUserPacks(data: any[], userIdMap: Map<number, number>): Promise<void> {
    for (const p of data) {
      const newUserId = userIdMap.get(p.userId);
      if (!newUserId) continue;
      await db.insert(userPacks).values({
        userId: newUserId,
        setCode: p.setCode,
        packType: p.packType,
        tag: p.tag || null,
        status: p.status,
        openedAt: p.openedAt ? new Date(p.openedAt) : null,
      });
    }
  }

  async bulkImportCollection(data: any[], userIdMap: Map<number, number>): Promise<void> {
    for (const c of data) {
      const newUserId = userIdMap.get(c.userId);
      if (!newUserId) continue;
      await db.insert(collection).values({
        userId: newUserId,
        cardId: c.cardId,
        quantity: c.quantity,
        isFoil: c.isFoil || false,
        tag: c.tag || null,
      });
    }
  }

  async bulkImportInvitationCodes(data: any[]): Promise<void> {
    for (const ic of data) {
      await db.insert(invitationCodes).values({
        code: ic.code,
        isUsed: ic.isUsed || false,
      }).onConflictDoNothing();
    }
  }

  async bulkImportBoosterTemplates(data: any[]): Promise<void> {
    for (const bt of data) {
      await db.insert(boosterTemplates).values({ name: bt.name, definition: bt.definition });
    }
  }

  async importPlayerCollection(userId: number, items: { cardId: string; quantity: number; isFoil: boolean; tag?: string }[]): Promise<number> {
    let imported = 0;
    for (const item of items) {
      const conditions = [
        eq(collection.userId, userId),
        eq(collection.cardId, item.cardId),
        eq(collection.isFoil, item.isFoil),
      ];
      if (item.tag) {
        conditions.push(eq(collection.tag, item.tag));
      } else {
        conditions.push(sql`${collection.tag} IS NULL`);
      }

      const [existing] = await db.select().from(collection).where(and(...conditions));
      if (existing) {
        await db.update(collection)
          .set({ quantity: existing.quantity + item.quantity })
          .where(eq(collection.id, existing.id));
      } else {
        await db.insert(collection).values({
          userId,
          cardId: item.cardId,
          quantity: item.quantity,
          isFoil: item.isFoil,
          tag: item.tag || null,
        });
      }
      imported += item.quantity;
    }
    return imported;
  }

  async getAllApiKeys(): Promise<ApiKey[]> {
    return await db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
  }

  async getApiKeyByKey(key: string): Promise<ApiKey | undefined> {
    const [row] = await db.select().from(apiKeys).where(and(eq(apiKeys.key, key), eq(apiKeys.isActive, true)));
    return row;
  }

  async createApiKey(name: string, createdBy: number): Promise<ApiKey> {
    const { randomBytes } = await import("crypto");
    const key = "mtg_" + randomBytes(24).toString("hex");
    const [row] = await db.insert(apiKeys).values({ name, key, createdBy, isActive: true }).returning();
    return row;
  }

  async revokeApiKey(id: number): Promise<void> {
    await db.update(apiKeys).set({ isActive: false }).where(eq(apiKeys.id, id));
  }

  async deleteApiKey(id: number): Promise<void> {
    await db.delete(apiKeys).where(eq(apiKeys.id, id));
  }

  async touchApiKeyUsed(id: number): Promise<void> {
    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, id));
  }

  async getAppSettings(): Promise<AppSettings> {
    const [row] = await db.select().from(appSettings).limit(1);
    if (row) return row;
    const [created] = await db.insert(appSettings).values({ appName: "MTG Pack Simulator" }).returning();
    return created;
  }

  async upsertAppSettings(settings: Partial<InsertAppSettings>): Promise<AppSettings> {
    const existing = await this.getAppSettings();
    const [updated] = await db.update(appSettings)
      .set({ ...settings, updatedAt: new Date() })
      .where(eq(appSettings.id, existing.id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
