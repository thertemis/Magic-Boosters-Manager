
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
import { filterCards } from "@shared/scryfall-filter";

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

// ===== Booster DSL (Legacy format: {r,75,m,25;u,100;c,100}) =====
type BoosterSlotDef = { entries: { rarity: string; probability: number; setCode?: string; useAllSets?: boolean; scryfallQuery?: string }[] };

// Convert comma-separated DSL filter string to space-separated Scryfall query.
// Handles: quoting multi-word values, stripping trailing commas from token values.
// e.g. "r:r, t:basic land, set:all" → 'r:r t:"basic land" set:all'
function normalizeDslQuery(query: string): string {
  // Split by commas outside quoted strings
  const parts: string[] = [];
  let current = "";
  let inQuote = false;
  for (const ch of query) {
    if (ch === '"') { inQuote = !inQuote; current += ch; }
    else if (ch === ',' && !inQuote) { if (current.trim()) parts.push(current.trim()); current = ""; }
    else { current += ch; }
  }
  if (current.trim()) parts.push(current.trim());

  // For each part, quote multi-word values that aren't already quoted
  const normalized = parts.map(part => {
    const m = part.match(/^(-?)([a-zA-Z]+)([:=<>!]+)(.+)$/);
    if (!m) return `"${part.replace(/"/g, "")}"`;
    const [, neg, field, op, value] = m;
    const trimVal = value.trim();
    if (trimVal.includes(" ") && !trimVal.startsWith('"')) {
      return `${neg}${field}${op}"${trimVal}"`;
    }
    return `${neg}${field}${op}${trimVal}`;
  });
  return normalized.join(" ");
}

// Extract an optional #syntax:scryfall / #syntax:legacy prefix line from a definition
function extractSyntaxMode(definition: string): { mode: "scryfall" | "legacy" | "auto"; cleanDef: string } {
  const match = definition.match(/^#syntax:(scryfall|legacy)\n([\s\S]*)$/i);
  if (match) return { mode: match[1].toLowerCase() as "scryfall" | "legacy", cleanDef: match[2] };
  return { mode: "auto", cleanDef: definition };
}

function parseBoosterDSL(definition: string): { slots: BoosterSlotDef[]; errors: string[] } {
  const errors: string[] = [];
  const slots: BoosterSlotDef[] = [];

  const { mode, cleanDef } = extractSyntaxMode(definition);
  const trimmed = cleanDef.trim();

  // Explicit scryfall mode or auto-detected new syntax
  if (mode === "scryfall" || (mode === "auto" && (/^\{?\s*\d+\s*\(/.test(trimmed) || /;\s*\d+\s*\(/.test(trimmed)))) {
    const wrapped = /^\{/.test(trimmed) ? trimmed : `{${trimmed}}`;
    return parseNewBoosterDSL(wrapped);
  }

  // Legacy syntax: {r,75,m,25;u,100;c,100}
  const cleaned = trimmed.replace(/^\{/, "").replace(/\}$/, "");
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
        errors.push(`Slot ${si + 1}: unknown rarity "${token}". Use c, u, r, or m.`);
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
      const prob = parseFloat(probToken);
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
      if (Math.abs(totalProb - 100) > 0.01) {
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

// ===== New Booster DSL: {5([r:r, t:"legendary creature"]:50,[r:m]:50);2([r:u, set:neo]:100)} =====
function parseNewBoosterDSL(definition: string): { slots: BoosterSlotDef[]; errors: string[] } {
  const errors: string[] = [];
  const slots: BoosterSlotDef[] = [];

  const cleaned = definition.trim().replace(/^\{/, "").replace(/\}$/, "");
  if (!cleaned) {
    errors.push("Empty definition");
    return { slots, errors };
  }

  // Split by semicolon but respect parentheses
  const slotGroups: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of cleaned) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (ch === ";" && depth === 0) {
      slotGroups.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) slotGroups.push(current.trim());

  for (const group of slotGroups) {
    // Pattern: N(entries) where N is slot count
    const match = group.match(/^(\d+)\((.+)\)$/);
    if (!match) {
      // Try legacy single slot: just r,75,m,25
      const legacyResult = parseBoosterDSL(`{${group}}`);
      if (legacyResult.errors.length === 0) {
        for (const slot of legacyResult.slots) slots.push(slot);
      } else {
        errors.push(`Cannot parse slot group: "${group}"`);
      }
      continue;
    }

    const count = parseInt(match[1]);
    const entriesStr = match[2];

    // Parse entries: [query]:pct,[query]:pct,...
    const entries: BoosterSlotDef["entries"] = [];

    // Split entries by comma outside brackets
    const entryStrings: string[] = [];
    let edepth = 0;
    let ecurrent = "";
    for (const ch of entriesStr) {
      if (ch === "[" || ch === "(") edepth++;
      if (ch === "]" || ch === ")") edepth--;
      if (ch === "," && edepth === 0) {
        entryStrings.push(ecurrent.trim());
        ecurrent = "";
      } else {
        ecurrent += ch;
      }
    }
    if (ecurrent.trim()) entryStrings.push(ecurrent.trim());

    // Group entries by [query]:pct pairs
    let i = 0;
    while (i < entryStrings.length) {
      const part = entryStrings[i].trim();
      // Check if it's [query]:pct format
      const queryMatch = part.match(/^\[(.+)\]:(\d+(?:\.\d+)?)$/);
      if (queryMatch) {
        const query = queryMatch[1].trim();
        const pct = parseFloat(queryMatch[2]);

        // Extract rarity and set from query
        let rarity = "common";
        let setCode: string | undefined;
        let useAllSets = false;
        let scryfallQuery = query; // Already valid space-separated Scryfall syntax

        const rarityMatch = query.match(/\br:(c|u|r|m|common|uncommon|rare|mythic)\b/i);
        if (rarityMatch) {
          const rm: Record<string, string> = { c: "common", u: "uncommon", r: "rare", m: "mythic" };
          rarity = rm[rarityMatch[1].toLowerCase()] || rarityMatch[1].toLowerCase();
        }

        const setMatch = query.match(/\bset:(\w+)\b/i);
        if (setMatch) {
          if (setMatch[1].toLowerCase() === "all") {
            useAllSets = true;
          } else {
            setCode = setMatch[1].toLowerCase();
          }
        }

        entries.push({ rarity, probability: pct, setCode, useAllSets, scryfallQuery });
        i++;
      } else {
        // Might be legacy r,75 format inline
        const legacyResult = parseBoosterDSL(`{${entryStrings.slice(i, i + 2).join(",")}}`);
        if (legacyResult.slots.length > 0 && legacyResult.errors.length === 0) {
          entries.push(...legacyResult.slots[0].entries);
          i += 2;
        } else {
          errors.push(`Cannot parse entry: "${part}"`);
          i++;
        }
      }
    }

    if (entries.length > 0) {
      const totalProb = entries.reduce((s, e) => s + e.probability, 0);
      if (Math.abs(totalProb - 100) > 0.01) {
        errors.push(`Slot group "${group}": probabilities sum to ${totalProb.toFixed(1)}%, must be 100%.`);
        continue;
      }
      for (let s = 0; s < count; s++) {
        slots.push({ entries });
      }
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

    const setCode = chosenEntry.useAllSets ? "*" : (chosenEntry.setCode || defaultSetCode);
    let setCards = allCardsBySet.get(setCode) || [];

    let pool: Card[];

    if (chosenEntry.scryfallQuery) {
      // Scryfall query handles all filtering (rarity, type, set, etc.) — fully compliant
      const filtered = filterCards(setCards, chosenEntry.scryfallQuery).filter(c => !c.disabled);
      pool = filtered.filter(c => !usedCardIds.has(c.id));
      if (pool.length === 0) pool = filtered; // fallback: allow duplicates
    } else {
      // Legacy DSL: filter by rarity slot
      pool = setCards.filter(c =>
        c.rarity === chosenEntry.rarity && !c.disabled && !usedCardIds.has(c.id)
      );
      if (pool.length === 0) {
        pool = setCards.filter(c => c.rarity === chosenEntry.rarity && !c.disabled);
      }
      // Last fallback: any rarity
      if (pool.length === 0 && setCards.length > 0) {
        pool = setCards.filter(c => !c.disabled && !usedCardIds.has(c.id));
        if (pool.length === 0) pool = setCards.filter(c => !c.disabled);
      }
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
    if (extendedArt.length > 0) addCard(pickUnique(extendedArt), false);
    else if (altRareMythic.length > 0) addCard(pickUnique(altRareMythic), false);
    else if (normalRareMythic.length > 0) addCard(pickUnique(normalRareMythic), false);

    const showcaseBorderless = nonBasicCards.filter(c =>
      (c.rarity === "rare" || c.rarity === "mythic") &&
      (c.borderColor === "borderless" || ((c.frameEffects as string[]) || []).includes("showcase"))
    );
    if (showcaseBorderless.length > 0) addCard(pickUnique(showcaseBorderless), true);
    else if (altRareMythic.length > 0) addCard(pickUnique(altRareMythic), true);
    else if (normalRareMythic.length > 0) addCard(pickUnique(normalRareMythic), true);

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
      await new Promise(resolve => setTimeout(resolve, 100));
    } else {
      nextUrl = "";
    }
  }
  return allCards;
}

function mapScryfallCard(c: any) {
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
    imageUris,
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
    power: c.power || null,
    toughness: c.toughness || null,
    loyalty: c.loyalty || null,
    producedMana: c.produced_mana || null,
    disabled: false,
  };
}

// ===== Background Scheduler =====
function startScheduler() {
  setInterval(async () => {
    try {
      const now = new Date();
      const currentHour = now.getUTCHours();

      const schedules = await storage.getActiveBoosterSchedules();
      for (const schedule of schedules) {
        if (schedule.scheduleHour !== currentHour) continue;

        // Check if already ran this hour
        if (schedule.lastRunAt) {
          const lastRun = new Date(schedule.lastRunAt);
          const sameDay = lastRun.getUTCFullYear() === now.getUTCFullYear() &&
            lastRun.getUTCMonth() === now.getUTCMonth() &&
            lastRun.getUTCDate() === now.getUTCDate() &&
            lastRun.getUTCHours() === currentHour;
          if (sameDay) continue;
        }

        // Determine which users to grant to
        let targetUserIds: number[] = [];
        if (schedule.userId) {
          targetUserIds = [schedule.userId];
        } else {
          const allUsers = await storage.getAllUsers();
          targetUserIds = allUsers.map(u => u.id);
        }

        for (const userId of targetUserIds) {
          for (let i = 0; i < schedule.quantity; i++) {
            await storage.grantPack(userId, schedule.setCode, schedule.packType, schedule.tag || undefined);
          }
        }

        await storage.markScheduleRan(schedule.id);
        console.log(`[Scheduler] Ran schedule "${schedule.name}" for ${targetUserIds.length} users`);
      }

      // Daily currency grants
      const econ = await storage.getEconomySettings();
      if (econ && econ.economyEnabled && econ.dailyCurrencyEnabled && econ.dailyCurrencyAmount > 0) {
        // Run once per day at midnight UTC
        if (currentHour === 0) {
          const allUsers = await storage.getAllUsers();
          for (const user of allUsers) {
            const bal = await storage.getUserBalance(user.id);
            if (bal.lastDailyClaimAt) {
              const lastClaim = new Date(bal.lastDailyClaimAt);
              const sameDay = lastClaim.getUTCFullYear() === now.getUTCFullYear() &&
                lastClaim.getUTCMonth() === now.getUTCMonth() &&
                lastClaim.getUTCDate() === now.getUTCDate();
              if (sameDay) continue;
            }
            await storage.claimDailyCurrency(user.id, econ.dailyCurrencyAmount);
          }
        }
      }
    } catch (err) {
      console.error("[Scheduler] Error:", err);
    }
  }, 60 * 1000);
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

  // ===== Auth Routes =====
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

  // ===== Public - App Settings =====
  app.get("/api/app/settings", async (_req, res) => {
    const settings = await storage.getAppSettings();
    res.json({ appName: settings.appName || "MTG Pack Simulator", hasFavicon: !!settings.faviconData });
  });

  app.get("/api/app/favicon", async (_req, res) => {
    const settings = await storage.getAppSettings();
    if (!settings.faviconData) return res.status(404).send("No custom favicon");
    const match = settings.faviconData.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return res.status(400).send("Invalid favicon data");
    const mimeType = match[1];
    const buffer = Buffer.from(match[2], "base64");
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(buffer);
  });

  // ===== Admin - App Settings =====
  app.patch("/api/admin/app/settings", isAdmin, async (req, res) => {
    const { appName, faviconData } = req.body as { appName?: string; faviconData?: string | null };
    const updates: { appName?: string; faviconData?: string | null } = {};
    if (appName !== undefined) updates.appName = appName.trim() || "MTG Pack Simulator";
    if (faviconData !== undefined) updates.faviconData = faviconData;
    const settings = await storage.upsertAppSettings(updates);
    res.json({ appName: settings.appName, hasFavicon: !!settings.faviconData });
  });

  // ===== Admin - Users =====
  app.get(api.admin.users.list.path, isAdmin, async (req, res) => {
    const allUsers = await storage.getAllUsers();
    res.json(allUsers);
  });

  app.post(api.admin.users.create.path, isAdmin, async (req, res) => {
    try {
      const input = api.admin.users.create.input.parse(req.body);
      const hashedPassword = await hashPassword(input.password);
      const user = await storage.createUser({ ...input, password: hashedPassword });
      res.status(201).json(user);
    } catch (err) {
      res.status(400).json({ message: "Error creating user" });
    }
  });

  app.patch("/api/admin/users/:id", isAdmin, async (req, res) => {
    const id = parseInt(req.params.id as string);
    const input = api.admin.users.update.input.parse(req.body);
    const updates: any = { ...input };
    if (updates.password) {
      updates.password = await hashPassword(updates.password);
    }
    const user = await storage.updateUser(id, updates);
    res.json(user);
  });

  app.delete("/api/admin/users/:id", isAdmin, async (req, res) => {
    const id = parseInt(req.params.id as string);
    await storage.deleteUser(id);
    res.json({ message: "User deleted" });
  });

  app.get("/api/admin/users/:id/packs", isAdmin, async (req, res) => {
    const id = parseInt(req.params.id as string);
    const packs = await storage.getUserPacks(id);
    res.json(packs);
  });

  app.get("/api/admin/users/:id/collection", isAdmin, async (req, res) => {
    const id = parseInt(req.params.id as string);
    const col = await storage.getUserCollection(id);
    res.json(col);
  });

  app.post("/api/admin/invitations", isAdmin, async (req, res) => {
    const { code } = req.body;
    await storage.createInvitationCode(code);
    res.status(201).json({ message: "Invitation code created" });
  });

  // ===== Admin - Sets =====
  app.get(api.admin.sets.list.path, isAdmin, async (req, res) => {
    const allSets = await storage.getAllSets();
    res.json(allSets);
  });

  app.get("/api/sets", isAuthenticated, async (req, res) => {
    const allSets = await storage.getAllSets();
    res.json(allSets.map(s => ({ code: s.code, name: s.name, releaseDate: s.releaseDate })));
  });

  app.get("/api/admin/cards/all", isAdmin, async (req, res) => {
    const allCards = await storage.getAllCards();
    res.json(allCards);
  });

  app.post(api.admin.sets.sync.path, isAdmin, async (req, res) => {
    try {
      const { setCode } = api.admin.sets.sync.input.parse(req.body);
      const setInfo = await fetchScryfallSet(setCode);

      await storage.createOrUpdateSet({
        code: setInfo.code,
        name: setInfo.name,
        releaseDate: setInfo.released_at,
        iconSvgUri: setInfo.icon_svg_uri,
        cardCount: setInfo.card_count,
        isActive: true,
      });

      const scryfallCards = await fetchScryfallCards(setCode);
      const cardsToSave = scryfallCards.map(mapScryfallCard);
      await storage.createOrUpdateCards(cardsToSave);

      res.json({ message: "Sync successful", addedCards: cardsToSave.length });
    } catch (err: any) {
      console.error("Sync error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // ===== Admin - Packs =====
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
    res.json({ message: `Tag "${tag}" removed.` });
  });

  app.delete("/api/admin/packs/:id", isAdmin, async (req, res) => {
    const packId = parseInt(req.params.id as string);
    const pack = await storage.getPack(packId);
    if (!pack) return res.status(404).json({ message: "Pack not found" });
    if (pack.status === "opened") return res.status(400).json({ message: "Cannot delete opened pack" });
    await storage.deletePack(packId);
    res.json({ message: "Pack deleted" });
  });

  // ===== Admin - Card Pool =====
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

  app.post("/api/admin/sets/:code/cards/bulk-toggle", isAdmin, async (req, res) => {
    const { cardIds, disabled } = req.body;
    if (!Array.isArray(cardIds)) return res.status(400).json({ message: "cardIds must be an array" });
    await storage.toggleCardsDisabled(cardIds, !!disabled);
    res.json({ message: `${cardIds.length} cards ${disabled ? "disabled" : "enabled"}`, count: cardIds.length });
  });

  app.post("/api/admin/cards/bulk-toggle", isAdmin, async (req, res) => {
    const { cardIds, disabled } = req.body;
    if (!Array.isArray(cardIds)) return res.status(400).json({ message: "cardIds must be an array" });
    await storage.toggleCardsDisabled(cardIds, !!disabled);
    res.json({ message: `${cardIds.length} cards ${disabled ? "disabled" : "enabled"}`, count: cardIds.length });
  });

  // ===== Admin - Booster Templates =====
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
    const id = parseInt(req.params.id as string);
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
    const id = parseInt(req.params.id as string);
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
    let needsAllSets = false;
    for (const slot of slots) {
      for (const entry of slot.entries) {
        if (entry.setCode) allSetCodes.add(entry.setCode);
        if (entry.useAllSets) needsAllSets = true;
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
    if (needsAllSets) {
      const allSets = await storage.getAllSets();
      const combined: Card[] = [];
      for (const s of allSets) {
        const sc = s.code;
        if (!allCardsBySet.has(sc)) {
          allCardsBySet.set(sc, await storage.getEnabledCardsBySet(sc));
        }
        combined.push(...(allCardsBySet.get(sc) || []));
      }
      allCardsBySet.set("*", combined);
    }

    const result = generateCustomPack(allCardsBySet, slots, setCode);
    res.json({ cards: result });
  });

  // ===== Admin - Economy Settings =====
  app.get("/api/admin/economy", isAdmin, async (req, res) => {
    const settings = await storage.getEconomySettings();
    res.json(settings || null);
  });

  app.put("/api/admin/economy", isAdmin, async (req, res) => {
    try {
      const settings = await storage.upsertEconomySettings(req.body);
      res.json(settings);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/admin/economy/balances", isAdmin, async (req, res) => {
    const balances = await storage.getAllUserBalances();
    res.json(balances);
  });

  app.post("/api/admin/economy/grant", isAdmin, async (req, res) => {
    const { userId, amount, description } = req.body;
    if (!userId || !amount) return res.status(400).json({ message: "userId and amount required" });
    await storage.adminGrantCurrency(parseInt(userId), parseInt(amount), description);
    res.json({ message: `Granted ${amount} currency to user ${userId}` });
  });

  app.put("/api/admin/economy/balances/:userId", isAdmin, async (req, res) => {
    const userId = parseInt(req.params.userId);
    const { balance } = req.body;
    if (isNaN(userId) || typeof balance !== "number" || balance < 0) {
      return res.status(400).json({ message: "Invalid userId or balance" });
    }
    const updated = await storage.adminSetBalance(userId, balance);
    res.json(updated);
  });

  app.get("/api/admin/economy/transactions", isAdmin, async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 100;
    const transactions = await storage.getAllTransactions(limit);
    res.json(transactions);
  });

  app.post("/api/admin/economy/refresh-prices", isAdmin, async (req, res) => {
    try {
      const updated = await storage.refreshCardPrices();
      res.json({ message: `Prices refreshed for ${updated} cards.`, updated });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ===== Admin - Market Pack Listings =====
  app.get("/api/admin/market/packs", isAdmin, async (req, res) => {
    const listings = await storage.getAllMarketPackListings();
    res.json(listings);
  });

  app.post("/api/admin/market/packs", isAdmin, async (req, res) => {
    try {
      const listing = await storage.createMarketPackListing(req.body);
      res.status(201).json(listing);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/admin/market/packs/:id", isAdmin, async (req, res) => {
    const id = parseInt(req.params.id as string);
    const listing = await storage.updateMarketPackListing(id, req.body);
    res.json(listing);
  });

  app.delete("/api/admin/market/packs/:id", isAdmin, async (req, res) => {
    const id = parseInt(req.params.id as string);
    await storage.deleteMarketPackListing(id);
    res.json({ message: "Listing deleted" });
  });

  // ===== Admin - Booster Schedules =====
  app.get("/api/admin/schedules", isAdmin, async (req, res) => {
    const schedules = await storage.getAllBoosterSchedules();
    res.json(schedules);
  });

  app.post("/api/admin/schedules", isAdmin, async (req, res) => {
    try {
      const schedule = await storage.createBoosterSchedule(req.body);
      res.status(201).json(schedule);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/admin/schedules/:id", isAdmin, async (req, res) => {
    const id = parseInt(req.params.id as string);
    const schedule = await storage.updateBoosterSchedule(id, req.body);
    res.json(schedule);
  });

  app.delete("/api/admin/schedules/:id", isAdmin, async (req, res) => {
    const id = parseInt(req.params.id as string);
    await storage.deleteBoosterSchedule(id);
    res.json({ message: "Schedule deleted" });
  });

  // ===== Player Routes =====
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
      let needsAllSets = false;
      for (const slot of slots) {
        for (const entry of slot.entries) {
          if (entry.setCode) allSetCodes.add(entry.setCode);
          if (entry.useAllSets) needsAllSets = true;
        }
      }
      const allCardsBySet = new Map<string, Card[]>();
      for (const sc of Array.from(allSetCodes)) {
        allCardsBySet.set(sc, await storage.getEnabledCardsBySet(sc));
      }
      if (needsAllSets) {
        const allSets = await storage.getAllSets();
        const combined: Card[] = [];
        for (const s of allSets) {
          const sc = s.code;
          if (!allCardsBySet.has(sc)) {
            allCardsBySet.set(sc, await storage.getEnabledCardsBySet(sc));
          }
          combined.push(...(allCardsBySet.get(sc) || []));
        }
        allCardsBySet.set("*", combined);
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
    const col = await storage.getUserCollection((req.user as any).id);
    res.json(col);
  });

  app.get(api.player.collection.tags.path, isAuthenticated, async (req, res) => {
    const tags = await storage.getUserTags((req.user as any).id);
    res.json(tags);
  });

  app.get(api.player.collection.exportByTag.path, isAuthenticated, async (req, res) => {
    const tag = req.params.tag as string;
    const items = await storage.getUserCollectionByTag((req.user as any).id, tag);
    res.send(aggregateForExport(items).join("\n"));
  });

  app.get(api.player.collection.export.path, isAuthenticated, async (req, res) => {
    const items = await storage.getUserCollection((req.user as any).id);
    res.send(aggregateForExport(items).join("\n"));
  });

  app.get(api.player.collection.exportCsv.path, isAuthenticated, async (req, res) => {
    const items = await storage.getUserCollection((req.user as any).id);
    res.setHeader("Content-Type", "text/csv");
    res.send(aggregateForMoxfieldCsv(items));
  });

  app.get(api.player.collection.exportCsvByTag.path, isAuthenticated, async (req, res) => {
    const tag = req.params.tag as string;
    const items = await storage.getUserCollectionByTag((req.user as any).id, tag);
    res.setHeader("Content-Type", "text/csv");
    res.send(aggregateForMoxfieldCsv(items));
  });

  app.patch(api.player.preferences.updateLanguage.path, isAuthenticated, async (req, res) => {
    const { language } = api.player.preferences.updateLanguage.input.parse(req.body);
    await storage.updateUserLanguage((req.user as any).id, language);
    res.json({ message: "Language preference updated" });
  });

  app.get("/api/player/profile", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).id;
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ id: user.id, username: user.username, role: user.role, discordUserId: user.discordUserId });
  });

  // ===== Player - Economy =====
  app.get("/api/player/balance", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).id;
    const [bal, econ] = await Promise.all([
      storage.getUserBalance(userId),
      storage.getEconomySettings(),
    ]);
    res.json({ balance: bal.balance, lastDailyClaimAt: bal.lastDailyClaimAt, settings: econ });
  });

  app.post("/api/player/balance/claim-daily", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).id;
    const econ = await storage.getEconomySettings();
    if (!econ || !econ.economyEnabled || !econ.dailyCurrencyEnabled) {
      return res.status(400).json({ message: "Daily currency not enabled" });
    }

    const bal = await storage.getUserBalance(userId);
    if (bal.lastDailyClaimAt) {
      const now = new Date();
      const last = new Date(bal.lastDailyClaimAt);
      if (
        last.getUTCFullYear() === now.getUTCFullYear() &&
        last.getUTCMonth() === now.getUTCMonth() &&
        last.getUTCDate() === now.getUTCDate()
      ) {
        return res.status(400).json({ message: "Daily currency already claimed today" });
      }
    }

    const updated = await storage.claimDailyCurrency(userId, econ.dailyCurrencyAmount);
    res.json({ balance: updated.balance, claimed: econ.dailyCurrencyAmount });
  });

  app.get("/api/player/transactions", isAuthenticated, async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const transactions = await storage.getUserTransactions((req.user as any).id, limit);
    res.json(transactions);
  });

  // ===== Player - Sell Cards =====
  app.post("/api/player/collection/sell", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const econ = await storage.getEconomySettings();
      if (!econ || !econ.economyEnabled || !econ.cardSellEnabled) {
        return res.status(400).json({ message: "Card selling not enabled" });
      }

      const { items } = req.body as { items: { cardId: string; isFoil: boolean; quantity: number }[] };
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "No items to sell" });
      }

      let totalEarned = 0;
      const results: { cardId: string; earned: number }[] = [];

      for (const item of items) {
        const col = await storage.getUserCollection(userId);
        const owned = col.find(c => c.cardId === item.cardId && c.isFoil === item.isFoil);
        if (!owned || owned.quantity < item.quantity) {
          continue;
        }
        if (owned.tag && owned.tag !== "marketplace") {
          continue;
        }

        const card = owned.card;
        const prices = (card.prices as any) || {};
        const priceUsd = item.isFoil
          ? parseFloat(prices.usd_foil || prices.usd || "0")
          : parseFloat(prices.usd || "0");

        const earned = Math.floor(priceUsd * econ.sellRateMultiplier * item.quantity * 100);

        await storage.removeFromCollection(userId, item.cardId, item.isFoil, item.quantity);
        await storage.adjustBalance(userId, earned, "card_sale", `Sold ${item.quantity}x ${card.name}`);
        totalEarned += earned;
        results.push({ cardId: item.cardId, earned });
      }

      res.json({ totalEarned, results, currencyName: econ.currencyName });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ===== Player - Marketplace =====
  app.get("/api/market/packs", isAuthenticated, async (req, res) => {
    const econ = await storage.getEconomySettings();
    if (!econ || !econ.economyEnabled || !econ.packStoreEnabled) {
      return res.json([]);
    }
    const listings = await storage.getActiveMarketPackListings();
    res.json(listings);
  });

  app.post("/api/market/packs/:id/buy", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const listingId = parseInt(req.params.id as string);
      const econ = await storage.getEconomySettings();
      if (!econ || !econ.economyEnabled || !econ.packStoreEnabled) {
        return res.status(400).json({ message: "Pack store not enabled" });
      }
      const pack = await storage.buyPackFromStore(userId, listingId);
      res.json({ message: "Pack purchased!", pack });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/market/cards", isAuthenticated, async (req, res) => {
    const econ = await storage.getEconomySettings();
    if (!econ || !econ.economyEnabled || !econ.userTradingEnabled) {
      return res.json([]);
    }
    const listings = await storage.getActiveCardListings();
    res.json(listings);
  });

  app.get("/api/market/cards/mine", isAuthenticated, async (req, res) => {
    const listings = await storage.getUserCardListings((req.user as any).id);
    res.json(listings);
  });

  app.post("/api/market/cards/list", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const econ = await storage.getEconomySettings();
      if (!econ || !econ.economyEnabled || !econ.userTradingEnabled) {
        return res.status(400).json({ message: "Card trading not enabled" });
      }

      const { cardId, isFoil, quantity, price } = req.body;
      if (!cardId || !price || !quantity) {
        return res.status(400).json({ message: "cardId, quantity, and price are required" });
      }

      const col = await storage.getUserCollection(userId);
      const owned = col.find(c => c.cardId === cardId && c.isFoil === !!isFoil);
      if (!owned || owned.quantity < quantity) {
        return res.status(400).json({ message: "Not enough cards in collection" });
      }
      if (owned.tag && owned.tag !== "marketplace") {
        return res.status(400).json({ message: `Cards with the event tag "${owned.tag}" cannot be listed on the marketplace.` });
      }

      await storage.removeFromCollection(userId, cardId, !!isFoil, quantity);
      const listing = await storage.createCardListing({
        sellerId: userId,
        cardId,
        isFoil: !!isFoil,
        quantity,
        price: parseInt(price),
        isActive: true,
      });
      res.status(201).json(listing);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/market/cards/:id/buy", isAuthenticated, async (req, res) => {
    try {
      const buyerId = (req.user as any).id;
      const listingId = parseInt(req.params.id as string);
      const { quantity } = req.body;
      const econ = await storage.getEconomySettings();
      if (!econ || !econ.economyEnabled || !econ.userTradingEnabled) {
        return res.status(400).json({ message: "Card trading not enabled" });
      }
      await storage.buyCardListing(buyerId, listingId, parseInt(quantity) || 1);
      res.json({ message: "Purchase successful!" });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/market/cards/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const listingId = parseInt(req.params.id as string);
      await storage.cancelCardListing(listingId, userId);
      res.json({ message: "Listing cancelled, cards returned to collection" });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // ===== Backup / Restore =====
  app.get("/api/admin/backup/export", isAdmin, async (req, res) => {
    try {
      const backup = {
        version: 2,
        exportedAt: new Date().toISOString(),
        users: await storage.getAllUsers(),
        sets: await storage.getAllSets(),
        cards: await storage.getAllCards(),
        packConfigs: await storage.getAllPackConfigs(),
        userPacks: await storage.getAllUserPacks(),
        collection: await storage.getAllCollectionItems(),
        invitationCodes: await storage.getAllInvitationCodes(),
        boosterTemplates: await storage.getAllBoosterTemplates(),
      };
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="mtg-backup-${new Date().toISOString().split("T")[0]}.json"`);
      res.send(JSON.stringify(backup, null, 2));
    } catch (err: any) {
      res.status(500).json({ message: "Export failed: " + err.message });
    }
  });

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
          userPacks: (backup.userPacks || []).length,
          collection: (backup.collection || []).length,
        },
      });
    } catch (err: any) {
      res.status(500).json({ message: "Import failed: " + err.message });
    }
  });

  app.post("/api/admin/users/:id/collection/import", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id as string);
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { items } = req.body;
      if (!items || !Array.isArray(items)) {
        return res.status(400).json({ message: "Invalid format. Expected { items: [...] }" });
      }
      const imported = await storage.importPlayerCollection(userId, items);
      res.json({ message: `Imported ${imported} cards into ${user.username}'s collection.`, count: imported });
    } catch (err: any) {
      res.status(500).json({ message: "Import failed: " + err.message });
    }
  });

  app.get("/api/admin/users/:id/collection/export", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id as string);
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
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

  // ===== Decklist Check =====
  app.post("/api/player/decklist-check", isAuthenticated, async (req, res) => {
    try {
      const { decklist } = req.body as { decklist: string };
      if (!decklist) return res.status(400).json({ message: "decklist is required" });
      const userId = (req.user as any).id;

      const userCollection = await storage.getUserCollection(userId);
      const ownedByName = new Map<string, number>();
      for (const item of userCollection) {
        const n = item.card.name.toLowerCase();
        ownedByName.set(n, (ownedByName.get(n) || 0) + item.quantity);
      }

      const lines = decklist.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("//") && !l.startsWith("#"));
      const results: { line: string; cardName: string; requested: number; owned: number; status: "owned" | "partial" | "missing" }[] = [];
      for (const line of lines) {
        const match = line.match(/^(\d+)?\s*(.+?)(?:\s+\([^)]+\)\s*\d+)?$/);
        if (!match) continue;
        const requested = match[1] ? parseInt(match[1]) : 1;
        const cardName = match[2].trim().replace(/\s*\([^)]+\)\s*\d*$/, "").trim();
        const owned = ownedByName.get(cardName.toLowerCase()) || 0;
        const status = owned >= requested ? "owned" : owned > 0 ? "partial" : "missing";
        results.push({ line, cardName, requested, owned, status });
      }
      res.json({ results, totalCards: results.length, owned: results.filter(r => r.status === "owned").length, partial: results.filter(r => r.status === "partial").length, missing: results.filter(r => r.status === "missing").length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ===== Admin Decklist Check =====
  app.post("/api/admin/decklist-check", isAdmin, async (req, res) => {
    try {
      const { userId, decklist } = req.body as { userId: number; decklist: string };
      if (!userId || !decklist) return res.status(400).json({ message: "userId and decklist are required" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const userCollection = await storage.getUserCollection(userId);
      const ownedByName = new Map<string, number>();
      for (const item of userCollection) {
        const n = item.card.name.toLowerCase();
        ownedByName.set(n, (ownedByName.get(n) || 0) + item.quantity);
      }
      const lines = decklist.split("\n").map((l: string) => l.trim()).filter((l: string) => l && !l.startsWith("//") && !l.startsWith("#"));
      const results: { line: string; cardName: string; requested: number; owned: number; status: "owned" | "partial" | "missing" }[] = [];
      for (const line of lines) {
        const match = line.match(/^(\d+)?\s*(.+?)(?:\s+\([^)]+\)\s*\d+)?$/);
        if (!match) continue;
        const requested = match[1] ? parseInt(match[1]) : 1;
        const cardName = match[2].trim().replace(/\s*\([^)]+\)\s*\d*$/, "").trim();
        const owned = ownedByName.get(cardName.toLowerCase()) || 0;
        const status: "owned" | "partial" | "missing" = owned >= requested ? "owned" : owned > 0 ? "partial" : "missing";
        results.push({ line, cardName, requested, owned, status });
      }
      res.json({ player: { id: user.id, username: user.username }, results, totalCards: results.length, owned: results.filter(r => r.status === "owned").length, partial: results.filter(r => r.status === "partial").length, missing: results.filter(r => r.status === "missing").length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ===== Admin API Keys =====
  app.get("/api/admin/api-keys", isAdmin, async (req, res) => {
    const keys = await storage.getAllApiKeys();
    res.json(keys.map(k => ({ ...k, key: k.key.substring(0, 12) + "..." })));
  });

  app.post("/api/admin/api-keys", isAdmin, async (req, res) => {
    const { name } = req.body as { name: string };
    if (!name) return res.status(400).json({ message: "name required" });
    const apiKey = await storage.createApiKey(name, (req.user as any).id);
    res.json(apiKey);
  });

  app.delete("/api/admin/api-keys/:id/revoke", isAdmin, async (req, res) => {
    await storage.revokeApiKey(parseInt(req.params.id as string));
    res.json({ message: "Revoked" });
  });

  app.delete("/api/admin/api-keys/:id", isAdmin, async (req, res) => {
    await storage.deleteApiKey(parseInt(req.params.id as string));
    res.json({ message: "Deleted" });
  });

  // ===== Public API v1 (API Key auth) =====
  async function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
    const key = (req.headers["x-api-key"] as string) || (req.query.api_key as string);
    if (!key) return res.status(401).json({ error: "API key required. Pass X-Api-Key header or ?api_key= query." });
    const apiKey = await storage.getApiKeyByKey(key);
    if (!apiKey) return res.status(401).json({ error: "Invalid or revoked API key." });
    storage.touchApiKeyUsed(apiKey.id).catch(() => {});
    (req as any).apiKeyRecord = apiKey;
    next();
  }

  app.get("/api/v1/users", apiKeyAuth, async (req, res) => {
    const allUsers = await storage.getAllUsers();
    res.json(allUsers.map(u => ({ id: u.id, username: u.username, role: u.role, discordUserId: u.discordUserId, createdAt: u.createdAt })));
  });

  app.get("/api/v1/users/discord/:discordId", apiKeyAuth, async (req, res) => {
    const user = await storage.getUserByDiscordId(req.params.discordId);
    if (!user) return res.status(404).json({ error: "No user linked to that Discord ID" });
    res.json({ id: user.id, username: user.username, role: user.role, discordUserId: user.discordUserId });
  });

  app.get("/api/v1/users/:id/collection", apiKeyAuth, async (req, res) => {
    const userId = parseInt(req.params.id as string);
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    const items = await storage.getUserCollection(userId);
    res.json(items.map(item => ({
      cardId: item.cardId,
      cardName: item.card.name,
      setCode: item.card.set,
      rarity: item.card.rarity,
      quantity: item.quantity,
      isFoil: item.isFoil,
      tag: item.tag,
    })));
  });

  app.post("/api/v1/users/:id/decklist-check", apiKeyAuth, async (req, res) => {
    const userId = parseInt(req.params.id as string);
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    const { decklist } = req.body as { decklist: string };
    if (!decklist) return res.status(400).json({ error: "decklist is required" });

    const userCollection = await storage.getUserCollection(userId);
    const ownedByName = new Map<string, number>();
    for (const item of userCollection) {
      const n = item.card.name.toLowerCase();
      ownedByName.set(n, (ownedByName.get(n) || 0) + item.quantity);
    }
    const lines = decklist.split("\n").map((l: string) => l.trim()).filter((l: string) => l && !l.startsWith("//") && !l.startsWith("#"));
    const results = lines.map((line: string) => {
      const match = line.match(/^(\d+)?\s*(.+?)(?:\s+\([^)]+\)\s*\d+)?$/);
      if (!match) return null;
      const requested = match[1] ? parseInt(match[1]) : 1;
      const cardName = match[2].trim().replace(/\s*\([^)]+\)\s*\d*$/, "").trim();
      const owned = ownedByName.get(cardName.toLowerCase()) || 0;
      const status = owned >= requested ? "owned" : owned > 0 ? "partial" : "missing";
      return { line, cardName, requested, owned, status };
    }).filter(Boolean);
    res.json({ userId, username: user.username, results, summary: { total: results.length, owned: results.filter((r: any) => r.status === "owned").length, partial: results.filter((r: any) => r.status === "partial").length, missing: results.filter((r: any) => r.status === "missing").length } });
  });

  app.get("/api/v1/sets", apiKeyAuth, async (req, res) => {
    const allSets = await storage.getAllSets();
    res.json(allSets);
  });

  app.get("/api/v1/sets/:code/cards", apiKeyAuth, async (req, res) => {
    const cards = await storage.getCardsBySet(req.params.code as string);
    res.json(cards);
  });

  app.get("/api/v1/economy", apiKeyAuth, async (req, res) => {
    const settings = await storage.getEconomySettings();
    res.json(settings);
  });

  app.get("/api/v1/users/:id/balance", apiKeyAuth, async (req, res) => {
    const userId = parseInt(req.params.id as string);
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    const balance = await storage.getUserBalance(userId);
    res.json({ userId, username: user.username, balance: balance.balance });
  });

  app.get("/api/v1/users/:id/packs", apiKeyAuth, async (req, res) => {
    const userId = parseInt(req.params.id as string);
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    const packs = await storage.getUserPacks(userId);
    res.json(packs);
  });

  // Helper: resolve a target spec to a User
  async function resolveTargetUser(target: { id?: number; username?: string; discordId?: string }): Promise<User | undefined> {
    if (target.id !== undefined) return storage.getUser(target.id);
    if (target.username) return storage.getUserByUsername(target.username);
    if (target.discordId) return storage.getUserByDiscordId(target.discordId);
    return undefined;
  }

  // POST /api/v1/users/grant-packs
  // Grant booster packs to one or more users
  // Body: { targets: [{id?, username?, discordId?}] | "all", setCode, packType, count?, tag? }
  app.post("/api/v1/users/grant-packs", apiKeyAuth, async (req, res) => {
    const { targets, setCode, packType, count = 1, tag } = req.body as {
      targets: { id?: number; username?: string; discordId?: string }[] | "all";
      setCode: string;
      packType: string;
      count?: number;
      tag?: string;
    };
    if (!setCode) return res.status(400).json({ error: "setCode is required" });
    if (!packType) return res.status(400).json({ error: "packType is required" });
    const set = await storage.getSet(setCode);
    if (!set) return res.status(404).json({ error: `Set '${setCode}' not found` });

    let userList: User[];
    if (targets === "all") {
      userList = await storage.getAllUsers();
    } else if (Array.isArray(targets) && targets.length > 0) {
      const resolved = await Promise.all(targets.map(resolveTargetUser));
      userList = resolved.filter((u): u is User => !!u);
    } else {
      return res.status(400).json({ error: "targets must be an array of user selectors or 'all'" });
    }

    let totalGranted = 0;
    const results: { userId: number; username: string; granted: number }[] = [];
    for (const user of userList) {
      for (let i = 0; i < count; i++) {
        await storage.grantPack(user.id, setCode, packType, tag);
      }
      totalGranted += count;
      results.push({ userId: user.id, username: user.username, granted: count });
    }
    res.json({ message: `Granted ${totalGranted} pack(s) to ${userList.length} user(s)`, results });
  });

  // POST /api/v1/users/grant-currency
  // Grant in-game currency to one or more users
  // Body: { targets: [{id?, username?, discordId?}] | "all", amount, description? }
  app.post("/api/v1/users/grant-currency", apiKeyAuth, async (req, res) => {
    const { targets, amount, description } = req.body as {
      targets: { id?: number; username?: string; discordId?: string }[] | "all";
      amount: number;
      description?: string;
    };
    if (typeof amount !== "number" || amount === 0) return res.status(400).json({ error: "amount must be a non-zero number" });

    let userList: User[];
    if (targets === "all") {
      userList = await storage.getAllUsers();
    } else if (Array.isArray(targets) && targets.length > 0) {
      const resolved = await Promise.all(targets.map(resolveTargetUser));
      userList = resolved.filter((u): u is User => !!u);
    } else {
      return res.status(400).json({ error: "targets must be an array of user selectors or 'all'" });
    }

    const results: { userId: number; username: string; newBalance: number }[] = [];
    for (const user of userList) {
      await storage.adminGrantCurrency(user.id, amount, description || "API grant");
      const bal = await storage.getUserBalance(user.id);
      results.push({ userId: user.id, username: user.username, newBalance: bal.balance });
    }
    res.json({ message: `Granted ${amount} currency to ${userList.length} user(s)`, results });
  });

  // PATCH /api/v1/settings
  // Update economy settings via API
  app.patch("/api/v1/settings", apiKeyAuth, async (req, res) => {
    const allowed = [
      "economyEnabled", "currencyName", "currencySymbol",
      "dailyClaimAmount", "sellRateMultiplier", "userTradingEnabled",
      "packSaleEnabled", "cardSaleEnabled",
    ];
    const updates: Record<string, any> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid settings fields provided", validFields: allowed });
    }
    const settings = await storage.upsertEconomySettings(updates);
    res.json({ message: "Settings updated", settings });
  });

  // PATCH /api/v1/users/:id/discord
  // Admin/API: set a user's discord ID
  app.patch("/api/v1/users/:id/discord", apiKeyAuth, async (req, res) => {
    const userId = parseInt(req.params.id);
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    const { discordUserId } = req.body as { discordUserId: string | null };
    const updated = await storage.setDiscordUserId(userId, discordUserId ?? null);
    res.json({ id: updated.id, username: updated.username, discordUserId: updated.discordUserId });
  });

  // ===== Player: link/unlink Discord ID =====
  app.patch("/api/player/discord", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).id;
    const { discordUserId } = req.body as { discordUserId: string | null };
    // Prevent duplicate: check no other user has this Discord ID
    if (discordUserId) {
      const existing = await storage.getUserByDiscordId(discordUserId);
      if (existing && existing.id !== userId) {
        return res.status(409).json({ message: "This Discord account is already linked to another user" });
      }
    }
    const updated = await storage.setDiscordUserId(userId, discordUserId ?? null);
    res.json({ discordUserId: updated.discordUserId });
  });

  // ===== Seed admin & start scheduler =====
  if ((await storage.getAllUsers()).length === 0) {
    const adminPassword = await hashPassword("admin");
    await storage.createUser({ username: "admin", password: adminPassword, role: "admin" });
    console.log("Seeded admin user: admin / admin");
  }

  // Ensure default economy settings exist
  const existingEcon = await storage.getEconomySettings();
  if (!existingEcon) {
    await storage.upsertEconomySettings({});
    console.log("Created default economy settings");
  }

  startScheduler();

  return httpServer;
}
