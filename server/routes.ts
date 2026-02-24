
import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import type { Card } from "@shared/schema";
import { z } from "zod";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import MemoryStore from "memorystore";

const scryptAsync = promisify(scrypt);

function aggregateForExport(items: Array<{ quantity: number; isFoil: boolean | null; card: { name: string; code: string; collectorNumber: string | null } }>) {
  const map = new Map<string, { qty: number; name: string; code: string; collectorNumber: string; isFoil: boolean }>();
  for (const item of items) {
    const key = `${item.card.name}|${item.card.code}|${item.card.collectorNumber || ""}`;
    const existing = map.get(key);
    if (existing) {
      existing.qty += item.quantity;
    } else {
      map.set(key, {
        qty: item.quantity,
        name: item.card.name,
        code: item.card.code,
        collectorNumber: item.card.collectorNumber || "",
        isFoil: !!item.isFoil,
      });
    }
  }
  return Array.from(map.values()).map(e =>
    `${e.qty} ${e.name} (${e.code.toUpperCase()}) ${e.collectorNumber}`.trim()
  );
}

function csvEscape(val: string): string {
  if (val.includes('"') || val.includes(',') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return `"${val}"`;
}

function aggregateForMoxfieldCsv(items: Array<{ quantity: number; isFoil: boolean | null; card: { name: string; code: string; collectorNumber: string | null } }>) {
  const map = new Map<string, { qty: number; name: string; code: string; collectorNumber: string; isFoil: boolean }>();
  for (const item of items) {
    const key = `${item.card.name}|${item.card.code}|${item.card.collectorNumber || ""}|${item.isFoil ? "foil" : ""}`;
    const existing = map.get(key);
    if (existing) {
      existing.qty += item.quantity;
    } else {
      map.set(key, {
        qty: item.quantity,
        name: item.card.name,
        code: item.card.code,
        collectorNumber: item.card.collectorNumber || "",
        isFoil: !!item.isFoil,
      });
    }
  }
  const now = new Date().toISOString().replace("T", " ").replace("Z", "");
  const header = `"Count","Tradelist Count","Name","Edition","Condition","Language","Foil","Tags","Last Modified","Collector Number","Alter","Proxy","Purchase Price"`;
  const rows = Array.from(map.values()).map(e => {
    const foilVal = e.isFoil ? "foil" : "";
    return `${csvEscape(String(e.qty))},${csvEscape(String(e.qty))},${csvEscape(e.name)},${csvEscape(e.code)},"Near Mint","English",${csvEscape(foilVal)},"",${csvEscape(now)},${csvEscape(e.collectorNumber)},"False","False",""`;
  });
  return [header, ...rows].join("\n");
}

type BoosterSlotDef = { entries: { rarity: string; probability: number; setCode?: string }[] };

function parseBoosterDSL(definition: string): { slots: BoosterSlotDef[]; errors: string[] } {
  const errors: string[] = [];
  const slots: BoosterSlotDef[] = [];

  const cleaned = definition.trim().replace(/^\{/, "").replace(/\}$/, "");
  if (!cleaned) {
    errors.push("Empty definition");
    return { slots, errors };
  }

  const slotStrings = cleaned.split(";");
  for (let si = 0; si < slotStrings.length; si++) {
    const slotStr = slotStrings[si].trim();
    if (!slotStr) continue;

    const tokens = slotStr.split(",").map(t => t.trim().toLowerCase());
    const entries: { rarity: string; probability: number; setCode?: string }[] = [];

    const rarityMap: Record<string, string> = { c: "common", u: "uncommon", r: "rare", m: "mythic" };

    let i = 0;
    let slotHasError = false;
    while (i < tokens.length) {
      let token = tokens[i];
      let setCode: string | undefined;

      if (token.includes(":")) {
        const parts = token.split(":");
        setCode = parts[0];
        token = parts[1];
      }

      if (!rarityMap[token]) {
        errors.push(`Slot ${si + 1}: unknown rarity "${token}". Use c, u, r, or m. (Optional set prefix: setcode:r)`);
        slotHasError = true;
        break;
      }
      i++;
      if (i >= tokens.length) {
        errors.push(`Slot ${si + 1}: missing probability after rarity "${token}".`);
        slotHasError = true;
        break;
      }
      const probToken = tokens[i];
      const prob = parseInt(probToken);
      if (isNaN(prob) || prob <= 0 || prob > 100) {
        errors.push(`Slot ${si + 1}: invalid probability "${probToken}". Must be 1-100.`);
        slotHasError = true;
        break;
      }
      i++;

      entries.push({ rarity: rarityMap[token], probability: prob, setCode });
    }

    if (slotHasError) continue;

    if (entries.length > 0) {
      const totalProb = entries.reduce((s, e) => s + e.probability, 0);
      if (totalProb !== 100) {
        errors.push(`Slot ${si + 1}: probabilities sum to ${totalProb}%, must be 100%.`);
        continue;
      }
      slots.push({ entries });
    }
  }

  if (slots.length === 0 && errors.length === 0) {
    errors.push("No valid slots found in definition.");
  }

  return { slots, errors };
}

function generateCustomPack(allCardsBySet: Map<string, Card[]>, slots: BoosterSlotDef[], defaultSetCode: string): OpenedCard[] {
  const result: OpenedCard[] = [];
  const usedCardIds = new Set<string>();

  for (const slot of slots) {
    const roll = Math.random() * 100;
    let cumulative = 0;
    let chosenEntry = slot.entries[0];

    for (const entry of slot.entries) {
      cumulative += entry.probability;
      if (roll < cumulative) {
        chosenEntry = entry;
        break;
      }
    }

    const setCode = chosenEntry.setCode || defaultSetCode;
    const setCards = allCardsBySet.get(setCode) || [];
    let pool = setCards.filter(c =>
      c.rarity === chosenEntry.rarity && !c.disabled && !usedCardIds.has(c.id)
    );

    if (pool.length === 0) {
      pool = setCards.filter(c => c.rarity === chosenEntry.rarity && !c.disabled);
    }

    if (pool.length > 0) {
      const card = random(pool);
      usedCardIds.add(card.id);
      result.push({ card, isFoil: false, isAltArt: isAltArt(card) });
    }
  }

  return result;
}

type OpenedCard = { card: Card; isFoil: boolean; isAltArt: boolean };

function isAltArt(card: Card): boolean {
  const fe = (card.frameEffects as string[]) || [];
  return (
    card.borderColor === "borderless" ||
    card.fullArt === true ||
    fe.includes("showcase") ||
    fe.includes("extendedart")
  );
}

function random<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickByRarity(rares: Card[], mythics: Card[], mythicChance: number): Card {
  if (mythics.length > 0 && Math.random() < mythicChance) {
    return random(mythics);
  }
  return rares.length > 0 ? random(rares) : random(mythics);
}

function isBasicLand(card: Card): boolean {
  return !!(card.typeLine?.toLowerCase().includes("basic land") || card.typeLine?.toLowerCase().startsWith("basic "));
}

function generatePack(allCards: Card[], packType: string, releaseDate?: string | null): OpenedCard[] {
  const nonBasicCards = allCards.filter(c => !isBasicLand(c));
  const normal = nonBasicCards.filter(c => !isAltArt(c));
  const altArt = nonBasicCards.filter(c => isAltArt(c));

  const normalCommons = normal.filter(c => c.rarity === "common");
  const normalUncommons = normal.filter(c => c.rarity === "uncommon");
  const normalRares = normal.filter(c => c.rarity === "rare");
  const normalMythics = normal.filter(c => c.rarity === "mythic");
  const normalRareMythic = normal.filter(c => c.rarity === "rare" || c.rarity === "mythic");

  const altCommons = altArt.filter(c => c.rarity === "common");
  const altUncommons = altArt.filter(c => c.rarity === "uncommon");
  const altRares = altArt.filter(c => c.rarity === "rare");
  const altMythics = altArt.filter(c => c.rarity === "mythic");
  const altRareMythic = altArt.filter(c => c.rarity === "rare" || c.rarity === "mythic");

  const allCommons = nonBasicCards.filter(c => c.rarity === "common");
  const allUncommons = nonBasicCards.filter(c => c.rarity === "uncommon");
  const allRares = nonBasicCards.filter(c => c.rarity === "rare");
  const allMythics = nonBasicCards.filter(c => c.rarity === "mythic");

  const result: OpenedCard[] = [];
  const usedIds = new Set<string>();

  const pickUnique = (pool: Card[]): Card | null => {
    const available = pool.filter(c => !usedIds.has(c.id));
    if (available.length === 0) return pool.length > 0 ? random(pool) : null;
    const card = random(available);
    usedIds.add(card.id);
    return card;
  };

  const addCard = (card: Card | null, isFoil: boolean) => {
    if (card) result.push({ card, isFoil, isAltArt: isAltArt(card) });
  };

  const pickUniqueByRarity = (rares: Card[], mythics: Card[], mythicChance: number): Card | null => {
    const availRares = rares.filter(c => !usedIds.has(c.id));
    const availMythics = mythics.filter(c => !usedIds.has(c.id));
    if (availMythics.length > 0 && Math.random() < mythicChance) {
      const card = random(availMythics);
      usedIds.add(card.id);
      return card;
    }
    if (availRares.length > 0) {
      const card = random(availRares);
      usedIds.add(card.id);
      return card;
    }
    if (availMythics.length > 0) {
      const card = random(availMythics);
      usedIds.add(card.id);
      return card;
    }
    return pickUnique([...rares, ...mythics]);
  };

  const releaseYear = releaseDate ? parseInt(releaseDate.substring(0, 4)) : 0;
  const hasMythics = allMythics.length > 0;
  const mythicChance = hasMythics ? 0.125 : 0;

  if (packType === "collector") {
    for (let i = 0; i < 2; i++) {
      const pool = altCommons.length > 0 ? altCommons : normalCommons;
      addCard(pickUnique(pool), true);
    }
    for (let i = 0; i < 2; i++) {
      const pool = altUncommons.length > 0 ? altUncommons : normalUncommons;
      addCard(pickUnique(pool), true);
    }
    for (let i = 0; i < 2; i++) {
      const pool = altUncommons.length > 0 ? altUncommons : normalUncommons;
      addCard(pickUnique(pool), false);
    }
    for (let i = 0; i < 2; i++) {
      const rPool = altRares.length > 0 ? altRares : normalRares;
      const mPool = altMythics.length > 0 ? altMythics : normalMythics;
      addCard(pickUniqueByRarity(rPool, mPool, mythicChance), false);
    }
    for (let i = 0; i < 2; i++) {
      const rPool = altRares.length > 0 ? altRares : normalRares;
      const mPool = altMythics.length > 0 ? altMythics : normalMythics;
      addCard(pickUniqueByRarity(rPool, mPool, mythicChance), true);
    }
    const extendedArt = nonBasicCards.filter(c =>
      (c.rarity === "rare" || c.rarity === "mythic") &&
      (((c.frameEffects as string[]) || []).includes("extendedart") || c.borderColor === "borderless")
    );
    if (extendedArt.length > 0) {
      addCard(pickUnique(extendedArt), false);
    } else if (altRareMythic.length > 0) {
      addCard(pickUnique(altRareMythic), false);
    } else if (normalRareMythic.length > 0) {
      addCard(pickUnique(normalRareMythic), false);
    }
    const showcaseBorderless = nonBasicCards.filter(c =>
      (c.rarity === "rare" || c.rarity === "mythic") &&
      (c.borderColor === "borderless" || ((c.frameEffects as string[]) || []).includes("showcase"))
    );
    if (showcaseBorderless.length > 0) {
      addCard(pickUnique(showcaseBorderless), true);
    } else if (altRareMythic.length > 0) {
      addCard(pickUnique(altRareMythic), true);
    } else if (normalRareMythic.length > 0) {
      addCard(pickUnique(normalRareMythic), true);
    }
    for (let i = 0; i < 3; i++) {
      const pool = altCommons.length > 0 ? altCommons : normalCommons;
      addCard(pickUnique(pool), true);
    }
  } else if (packType === "play" && releaseYear >= 2024) {
    for (let i = 0; i < 6; i++) {
      addCard(pickUnique(normalCommons.length > 0 ? normalCommons : allCommons), false);
    }
    for (let i = 0; i < 3; i++) {
      addCard(pickUnique(normalUncommons.length > 0 ? normalUncommons : allUncommons), false);
    }
    addCard(pickUniqueByRarity(normalRares.length > 0 ? normalRares : allRares, normalMythics.length > 0 ? normalMythics : allMythics, mythicChance), false);
    {
      const useAlt = Math.random() < 0.024 && altArt.length > 0;
      const pool = useAlt ? altArt : normal;
      addCard(pickUnique(pool.length > 0 ? pool : nonBasicCards), false);
    }
    {
      const useAlt = Math.random() < 0.015 && altArt.length > 0;
      const pool = useAlt ? altArt : normal;
      addCard(pickUnique(pool.length > 0 ? pool : nonBasicCards), true);
    }
    addCard(pickUnique(normalCommons.length > 0 ? normalCommons : allCommons), false);
    addCard(pickUnique(normalCommons.length > 0 ? normalCommons : allCommons), false);
  } else {
    addCard(pickUniqueByRarity(allRares.length > 0 ? allRares : allCommons, allMythics, mythicChance), false);
    for (let i = 0; i < 3; i++) {
      addCard(pickUnique(allUncommons.length > 0 ? allUncommons : allCommons), false);
    }
    const hasFoilSlot = Math.random() < 0.25;
    const numCommons = hasFoilSlot ? 10 : 11;
    for (let i = 0; i < numCommons; i++) {
      addCard(pickUnique(allCommons), false);
    }
    if (hasFoilSlot) {
      addCard(pickUnique(nonBasicCards), true);
    }
  }

  return result;
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Scryfall API Helpers
async function fetchScryfallSet(code: string) {
  const res = await fetch(`https://api.scryfall.com/sets/${code}`);
  if (!res.ok) throw new Error(`Failed to fetch set: ${res.statusText}`);
  return res.json();
}

async function fetchScryfallCards(code: string) {
  let allCards: any[] = [];
  let nextUrl = `https://api.scryfall.com/cards/search?q=set:${code}`;

  while (nextUrl) {
    const res = await fetch(nextUrl);
    if (!res.ok) throw new Error(`Failed to fetch cards: ${res.statusText}`);
    const data = await res.json();
    allCards = [...allCards, ...data.data];
    if (data.has_more) {
      nextUrl = data.next_page;
      // Scryfall asks for 50-100ms delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    } else {
      nextUrl = "";
    }
  }
  return allCards;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  const SessionStore = MemoryStore(session);
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "secret",
      resave: false,
      saveUninitialized: false,
      store: new SessionStore({ checkPeriod: 86400000 }),
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ message: "Unauthorized" });
  };

  const isAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated() && (req.user as any).role === "admin") return next();
    res.status(403).json({ message: "Forbidden" });
  };

  // Auth Routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password, invitationCode } = req.body;
      if (!username || !password || !invitationCode) {
        return res.status(400).json({ message: "Username, password and invitation code are required" });
      }

      const invitation = await storage.getInvitationCode(invitationCode);
      if (!invitation) {
        return res.status(400).json({ message: "Invalid or already used invitation code" });
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({ username, password: hashedPassword, role: "player" });
      await storage.useInvitationCode(invitationCode);

      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Error logging in after registration" });
        res.status(201).json(user);
      });
    } catch (err) {
      res.status(500).json({ message: "Registration error" });
    }
  });

  app.post(api.auth.login.path, passport.authenticate("local"), (req, res) => {
    res.json(req.user);
  });

  app.post(api.auth.logout.path, (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get(api.auth.me.path, isAuthenticated, (req, res) => {
    res.json(req.user);
  });

  // Admin Routes
  app.get(api.admin.users.list.path, isAdmin, async (req, res) => {
    const users = await storage.getAllUsers();
    res.json(users);
  });

  app.post(api.admin.users.create.path, isAdmin, async (req, res) => {
    try {
      const input = api.admin.users.create.input.parse(req.body);
      const hashedPassword = await hashPassword(input.password);
      const user = await storage.createUser({ ...input, password: hashedPassword });
      res.status(201).json(user);
    } catch (err) {
       // handle existing user error etc
       res.status(400).json({ message: "Error creating user" });
    }
  });

  app.patch("/api/admin/users/:id", isAdmin, async (req, res) => {
    const id = parseInt(req.params.id as any);
    const input = api.admin.users.update.input.parse(req.body);
    const updates: any = { ...input };
    if (updates.password) {
      updates.password = await hashPassword(updates.password);
    }
    const user = await storage.updateUser(id, updates);
    res.json(user);
  });

  app.delete("/api/admin/users/:id", isAdmin, async (req, res) => {
    const id = parseInt(req.params.id as any);
    await storage.deleteUser(id);
    res.json({ message: "User deleted" });
  });

  app.get("/api/admin/users/:id/packs", isAdmin, async (req, res) => {
    const id = parseInt(req.params.id as any);
    const packs = await storage.getUserPacks(id);
    res.json(packs);
  });

  app.get("/api/admin/users/:id/collection", isAdmin, async (req, res) => {
    const id = parseInt(req.params.id as any);
    const collection = await storage.getUserCollection(id);
    res.json(collection);
  });

  app.post("/api/admin/invitations", isAdmin, async (req, res) => {
    const { code } = req.body;
    await storage.createInvitationCode(code);
    res.status(201).json({ message: "Invitation code created" });
  });

  app.get(api.admin.sets.list.path, isAdmin, async (req, res) => {
    const sets = await storage.getAllSets();
    res.json(sets);
  });

  app.post(api.admin.sets.sync.path, isAdmin, async (req, res) => {
    try {
      const { setCode } = api.admin.sets.sync.input.parse(req.body);
      
      // 1. Fetch Set Info
      const setInfo = await fetchScryfallSet(setCode);
      
      await storage.createOrUpdateSet({
        code: setInfo.code,
        name: setInfo.name,
        releaseDate: setInfo.released_at,
        iconSvgUri: setInfo.icon_svg_uri,
        cardCount: setInfo.card_count,
        isActive: true,
      });

      // 2. Fetch Cards
      const scryfallCards = await fetchScryfallCards(setCode);
      
      // Transform and Save Cards
      const cardsToSave = scryfallCards.map((c: any) => {
        let imageUris = c.image_uris;
        if (!imageUris && c.card_faces && c.card_faces.length > 0 && c.card_faces[0].image_uris) {
          imageUris = c.card_faces[0].image_uris;
        }
        return {
        id: c.id,
        oracleId: c.oracle_id,
        code: c.set,
        mtgoId: c.mtgo_id,
        name: c.name,
        lang: c.lang,
        uri: c.uri,
        scryfallUri: c.scryfall_uri,
        layout: c.layout,
        highresImage: c.highres_image,
        imageStatus: c.image_status,
        imageUris: imageUris,
        manaCost: c.mana_cost,
        cmc: c.cmc,
        typeLine: c.type_line,
        oracleText: c.oracle_text,
        colors: c.colors,
        colorIdentity: c.color_identity,
        keywords: c.keywords,
        legalities: c.legalities,
        games: c.games,
        reserved: c.reserved,
        foil: c.foil,
        nonfoil: c.nonfoil,
        finishes: c.finishes,
        oversized: c.oversized,
        promo: c.promo,
        reprint: c.reprint,
        variation: c.variation,
        setId: c.set_id,
        set: c.set,
        setName: c.set_name,
        setType: c.set_type,
        setUri: c.set_uri,
        setSearchUri: c.set_search_uri,
        scryfallSetUri: c.scryfall_set_uri,
        rulingsUri: c.rulings_uri,
        printsSearchUri: c.prints_search_uri,
        collectorNumber: c.collector_number,
        digital: c.digital,
        rarity: c.rarity,
        flavorText: c.flavor_text,
        cardBackId: c.card_back_id,
        artist: c.artist,
        artistIds: c.artist_ids,
        illustrationId: c.illustration_id,
        borderColor: c.border_color,
        frame: c.frame,
        fullArt: c.full_art,
        textless: c.textless,
        booster: c.booster,
        storySpotlight: c.story_spotlight,
        edhrecRank: c.edhrec_rank,
        prices: c.prices,
        relatedUris: c.related_uris,
        frameEffects: c.frame_effects || [],
        promoTypes: c.promo_types || [],
        cardFaces: c.card_faces || null,
        disabled: false,
      };
      });

      await storage.createOrUpdateCards(cardsToSave);

      res.json({ message: "Sync successful", addedCards: cardsToSave.length });
    } catch (err: any) {
      console.error("Sync error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post(api.admin.packs.grant.path, isAdmin, async (req, res) => {
    const { userId, setCode, packType, count, tag } = api.admin.packs.grant.input.parse(req.body);
    for (let i = 0; i < count; i++) {
      await storage.grantPack(userId, setCode, packType, tag);
    }
    res.json({ message: "Packs granted", count });
  });

  app.get(api.admin.tags.list.path, isAdmin, async (req, res) => {
    const tags = await storage.getAllTags();
    res.json(tags);
  });

  app.delete(api.admin.tags.remove.path, isAdmin, async (req, res) => {
    const tag = req.params.tag as string;
    await storage.removeTag(tag);
    res.json({ message: `Tag "${tag}" removed. Cards remain in collections but are now untagged.` });
  });

  app.delete("/api/admin/packs/:id", isAdmin, async (req, res) => {
    const packId = parseInt(req.params.id);
    const pack = await storage.getPack(packId);
    if (!pack) return res.status(404).json({ message: "Pack not found" });
    if (pack.status === "opened") return res.status(400).json({ message: "Cannot delete opened pack" });

    await storage.deletePack(packId);
    res.json({ message: "Pack deleted" });
  });

  // Card Pool Management
  app.get(api.admin.sets.cards.path, isAdmin, async (req, res) => {
    const code = req.params.code as string;
    const allCards = await storage.getCardsBySetWithDisabled(code);
    res.json(allCards);
  });

  app.patch(api.admin.sets.toggleCard.path, isAdmin, async (req, res) => {
    const cardId = req.params.id as string;
    const { disabled } = api.admin.sets.toggleCard.input.parse(req.body);
    await storage.toggleCardDisabled(cardId, disabled);
    res.json({ message: `Card ${disabled ? "disabled" : "enabled"}` });
  });

  // Booster Templates
  app.get(api.admin.boosterTemplates.list.path, isAdmin, async (req, res) => {
    const templates = await storage.getAllBoosterTemplates();
    res.json(templates);
  });

  app.post(api.admin.boosterTemplates.create.path, isAdmin, async (req, res) => {
    const { name, definition } = api.admin.boosterTemplates.create.input.parse(req.body);
    const { slots, errors } = parseBoosterDSL(definition);
    if (errors.length > 0) {
      return res.status(400).json({ message: errors.join("; ") });
    }
    const template = await storage.createBoosterTemplate({ name, definition });
    res.status(201).json(template);
  });

  app.patch(api.admin.boosterTemplates.update.path, isAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    const updates = api.admin.boosterTemplates.update.input.parse(req.body);
    if (updates.definition) {
      const { errors } = parseBoosterDSL(updates.definition);
      if (errors.length > 0) {
        return res.status(400).json({ message: errors.join("; ") });
      }
    }
    const template = await storage.updateBoosterTemplate(id, updates);
    res.json(template);
  });

  app.delete(api.admin.boosterTemplates.delete.path, isAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteBoosterTemplate(id);
    res.json({ message: "Template deleted" });
  });

  app.post(api.admin.boosterTemplates.validate.path, isAdmin, async (req, res) => {
    const { definition } = api.admin.boosterTemplates.validate.input.parse(req.body);
    const { slots, errors } = parseBoosterDSL(definition);
    res.json({ valid: errors.length === 0, errors, slots: slots.length });
  });

  app.post(api.admin.boosterTemplates.testGenerate.path, isAdmin, async (req, res) => {
    const { definition, setCode } = api.admin.boosterTemplates.testGenerate.input.parse(req.body);
    const { slots, errors } = parseBoosterDSL(definition);
    if (errors.length > 0) {
      return res.status(400).json({ message: errors.join("; ") });
    }

    const allSetCodes = new Set([setCode]);
    for (const slot of slots) {
      for (const entry of slot.entries) {
        if (entry.setCode) allSetCodes.add(entry.setCode);
      }
    }

    const allCardsBySet = new Map<string, Card[]>();
    for (const sc of Array.from(allSetCodes)) {
      const setCards = await storage.getEnabledCardsBySet(sc);
      if (setCards.length === 0) {
        return res.status(400).json({ message: `Set "${sc}" has no cards or doesn't exist.` });
      }
      allCardsBySet.set(sc, setCards);
    }

    const result = generateCustomPack(allCardsBySet, slots, setCode);
    res.json({ cards: result });
  });

  // Player Routes
  app.get(api.player.packs.list.path, isAuthenticated, async (req, res) => {
    const packs = await storage.getUserPacks((req.user as any).id);
    res.json(packs);
  });

  app.post(api.player.packs.open.path, isAuthenticated, async (req, res) => {
    const packId = parseInt(req.params.id as string);
    const pack = await storage.getPack(packId);

    if (!pack || pack.userId !== (req.user as any).id) {
      return res.status(404).json({ message: "Pack not found" });
    }
    if (pack.status === "opened") {
      return res.status(400).json({ message: "Pack already opened" });
    }

    const setInfo = await storage.getSet(pack.setCode);

    // Check if this is a custom template
    if (pack.packType.startsWith("template:")) {
      const templateId = parseInt(pack.packType.split(":")[1]);
      const template = await storage.getBoosterTemplate(templateId);
      if (!template) {
        return res.status(500).json({ message: "Custom booster template not found." });
      }
      const { slots, errors } = parseBoosterDSL(template.definition);
      if (errors.length > 0) {
        return res.status(500).json({ message: "Invalid booster template definition." });
      }
      const allSetCodes = new Set([pack.setCode]);
      for (const slot of slots) {
        for (const entry of slot.entries) {
          if (entry.setCode) allSetCodes.add(entry.setCode);
        }
      }
      const allCardsBySet = new Map<string, Card[]>();
      for (const sc of Array.from(allSetCodes)) {
        allCardsBySet.set(sc, await storage.getEnabledCardsBySet(sc));
      }
      const openedCards = generateCustomPack(allCardsBySet, slots, pack.setCode);

      for (const oc of openedCards) {
        await storage.addToCollection((req.user as any).id, oc.card.id, oc.isFoil, pack.tag || undefined);
      }
      await storage.openPack(packId);
      return res.json({ packId, cards: openedCards });
    }

    const allCards = await storage.getEnabledCardsBySet(pack.setCode);
    if (allCards.length === 0) {
      return res.status(500).json({ message: "Set data not found. Contact admin to sync set." });
    }

    const openedCards = generatePack(allCards, pack.packType, setInfo?.releaseDate);

    for (const oc of openedCards) {
      await storage.addToCollection((req.user as any).id, oc.card.id, oc.isFoil, pack.tag || undefined);
    }

    await storage.openPack(packId);

    res.json({ packId, cards: openedCards });
  });

  app.get(api.player.collection.list.path, isAuthenticated, async (req, res) => {
    const collection = await storage.getUserCollection((req.user as any).id);
    res.json(collection);
  });

  app.get(api.player.collection.tags.path, isAuthenticated, async (req, res) => {
    const tags = await storage.getUserTags((req.user as any).id);
    res.json(tags);
  });

  app.get(api.player.collection.exportByTag.path, isAuthenticated, async (req, res) => {
    const tag = req.params.tag as string;
    const items = await storage.getUserCollectionByTag((req.user as any).id, tag);
    const aggregated = aggregateForExport(items);
    res.send(aggregated.join("\n"));
  });

  app.get(api.player.collection.export.path, isAuthenticated, async (req, res) => {
    const items = await storage.getUserCollection((req.user as any).id);
    const aggregated = aggregateForExport(items);
    res.send(aggregated.join("\n"));
  });

  app.get(api.player.collection.exportCsv.path, isAuthenticated, async (req, res) => {
    const items = await storage.getUserCollection((req.user as any).id);
    const csv = aggregateForMoxfieldCsv(items);
    res.setHeader("Content-Type", "text/csv");
    res.send(csv);
  });

  app.get(api.player.collection.exportCsvByTag.path, isAuthenticated, async (req, res) => {
    const tag = req.params.tag as string;
    const items = await storage.getUserCollectionByTag((req.user as any).id, tag);
    const csv = aggregateForMoxfieldCsv(items);
    res.setHeader("Content-Type", "text/csv");
    res.send(csv);
  });

  app.patch(api.player.preferences.updateLanguage.path, isAuthenticated, async (req, res) => {
    const { language } = api.player.preferences.updateLanguage.input.parse(req.body);
    await storage.updateUserLanguage((req.user as any).id, language);
    res.json({ message: "Language preference updated" });
  });

  // ===== Full Database Export =====
  app.get("/api/admin/backup/export", isAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const allSets = await storage.getAllSets();
      const allCards = await storage.getAllCards();
      const allPackConfigs = await storage.getAllPackConfigs();
      const allUserPacks = await storage.getAllUserPacks();
      const allCollection = await storage.getAllCollectionItems();
      const allInvitationCodes = await storage.getAllInvitationCodes();
      const allBoosterTemplates = await storage.getAllBoosterTemplates();

      const backup = {
        version: 1,
        exportedAt: new Date().toISOString(),
        users: allUsers,
        sets: allSets,
        cards: allCards,
        packConfigs: allPackConfigs,
        userPacks: allUserPacks,
        collection: allCollection,
        invitationCodes: allInvitationCodes,
        boosterTemplates: allBoosterTemplates,
      };

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="mtg-backup-${new Date().toISOString().split("T")[0]}.json"`);
      res.send(JSON.stringify(backup, null, 2));
    } catch (err: any) {
      console.error("Export error:", err);
      res.status(500).json({ message: "Export failed: " + err.message });
    }
  });

  // ===== Full Database Import =====
  app.post("/api/admin/backup/import", isAdmin, async (req, res) => {
    try {
      const backup = req.body;
      if (!backup || !backup.users || !backup.sets) {
        return res.status(400).json({ message: "Invalid backup file format." });
      }

      await storage.clearAllData();

      const userIdMap = await storage.bulkImportUsers(backup.users || []);
      await storage.bulkImportSets(backup.sets || []);
      await storage.bulkImportCards(backup.cards || []);
      await storage.bulkImportPackConfigs(backup.packConfigs || []);
      await storage.bulkImportUserPacks(backup.userPacks || [], userIdMap);
      await storage.bulkImportCollection(backup.collection || [], userIdMap);
      await storage.bulkImportInvitationCodes(backup.invitationCodes || []);
      await storage.bulkImportBoosterTemplates(backup.boosterTemplates || []);

      res.json({
        message: "Import successful",
        imported: {
          users: (backup.users || []).length,
          sets: (backup.sets || []).length,
          cards: (backup.cards || []).length,
          packConfigs: (backup.packConfigs || []).length,
          userPacks: (backup.userPacks || []).length,
          collection: (backup.collection || []).length,
          invitationCodes: (backup.invitationCodes || []).length,
          boosterTemplates: (backup.boosterTemplates || []).length,
        },
      });
    } catch (err: any) {
      console.error("Import error:", err);
      res.status(500).json({ message: "Import failed: " + err.message });
    }
  });

  // ===== Import Player Collection =====
  app.post("/api/admin/users/:id/collection/import", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { items } = req.body;
      if (!items || !Array.isArray(items)) {
        return res.status(400).json({ message: "Invalid format. Expected { items: [...] }" });
      }

      const imported = await storage.importPlayerCollection(userId, items);
      res.json({ message: `Imported ${imported} cards into ${user.username}'s collection.`, count: imported });
    } catch (err: any) {
      console.error("Collection import error:", err);
      res.status(500).json({ message: "Import failed: " + err.message });
    }
  });

  // ===== Export Player Collection as JSON =====
  app.get("/api/admin/users/:id/collection/export", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const items = await storage.getUserCollection(userId);
      const exportData = {
        userId: user.id,
        username: user.username,
        exportedAt: new Date().toISOString(),
        items: items.map(item => ({
          cardId: item.cardId,
          quantity: item.quantity,
          isFoil: !!item.isFoil,
          tag: item.tag || null,
          cardName: item.card.name,
          setCode: item.card.set,
          collectorNumber: item.card.collectorNumber,
        })),
      };

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${user.username}-collection.json"`);
      res.send(JSON.stringify(exportData, null, 2));
    } catch (err: any) {
      res.status(500).json({ message: "Export failed: " + err.message });
    }
  });

  // Seed Admin User
  if ((await storage.getAllUsers()).length === 0) {
    const adminPassword = await hashPassword("admin");
    await storage.createUser({
      username: "admin",
      password: adminPassword,
      role: "admin",
    });
    console.log("Seeded admin user: admin / admin");
  }

  return httpServer;
}
