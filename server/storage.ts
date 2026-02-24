
import { db } from "./db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
  users, sets, cards, packConfigs, userPacks, collection, invitationCodes, boosterTemplates,
  type User, type InsertUser, type Set, type Card, type PackConfig, type UserPack, type CollectionItem,
  type BoosterTemplate, type InsertBoosterTemplate
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

  // Card Pool Management
  toggleCardDisabled(cardId: string, disabled: boolean): Promise<void>;
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

  // Full Backup / Restore
  getAllUsers(): Promise<User[]>;
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

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }

  async deleteUser(id: number): Promise<void> {
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
    // Upsert in batches to avoid query size limits
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
            // Add other fields as necessary for updates
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

    const [existing] = await db.select()
      .from(collection)
      .where(and(...conditions));

    if (existing) {
      await db.update(collection)
        .set({ quantity: existing.quantity + 1 })
        .where(eq(collection.id, existing.id));
    } else {
      await db.insert(collection).values({
        userId,
        cardId,
        quantity: 1,
        isFoil,
        tag: tag || null,
      });
    }
  }

  async getUserCollection(userId: number): Promise<(CollectionItem & { card: Card })[]> {
    const items = await db.select({
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

    return items;
  }

  async getUserCollectionByTag(userId: number, tag: string): Promise<(CollectionItem & { card: Card })[]> {
    const items = await db.select({
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

    return items;
  }

  async getUserTags(userId: number): Promise<string[]> {
    const results = await db.selectDistinct({ tag: collection.tag })
      .from(collection)
      .where(and(eq(collection.userId, userId), sql`${collection.tag} IS NOT NULL`));
    return results.map(r => r.tag!).filter(Boolean);
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
    await db.update(userPacks)
      .set({ tag: null })
      .where(eq(userPacks.tag, tag));
    await db.update(collection)
      .set({ tag: null })
      .where(eq(collection.tag, tag));
  }

  async toggleCardDisabled(cardId: string, disabled: boolean): Promise<void> {
    await db.update(cards)
      .set({ disabled })
      .where(eq(cards.id, cardId));
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
    await db.update(users)
      .set({ preferredLanguage: language })
      .where(eq(users.id, userId));
  }

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
      await db.insert(boosterTemplates).values({
        name: bt.name,
        definition: bt.definition,
      });
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
}

export const storage = new DatabaseStorage();
