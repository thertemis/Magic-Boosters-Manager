
import type { Card } from "./schema";

type FilterFn = (card: Card) => boolean;

const COLOR_MAP: Record<string, string> = {
  w: "W", white: "W",
  u: "U", blue: "U",
  b: "B", black: "B",
  r: "R", red: "R",
  g: "G", green: "G",
  c: "C", colorless: "C",
};

const RARITY_MAP: Record<string, string> = {
  c: "common", common: "common",
  u: "uncommon", uncommon: "uncommon",
  r: "rare", rare: "rare",
  m: "mythic", mythic: "mythic",
};

function getCardColors(card: Card): string[] {
  const c = (card.colors as string[]) || [];
  if (c.length === 0) return ["C"];
  return c;
}

function getCardColorIdentity(card: Card): string[] {
  const c = (card.colorIdentity as string[]) || [];
  if (c.length === 0) return ["C"];
  return c;
}

function buildColorFilter(op: string, val: string, useIdentity = false): FilterFn {
  const requestedColors = val.split("").map(ch => COLOR_MAP[ch.toLowerCase()]).filter(Boolean);
  if (requestedColors.length === 0) return () => true;

  return (card: Card) => {
    const cardColors = useIdentity ? getCardColorIdentity(card) : getCardColors(card);

    if (op === "=" || op === ":") {
      if (requestedColors.includes("C")) {
        return cardColors.includes("C") || cardColors.length === 0;
      }
      return (
        requestedColors.every(rc => cardColors.includes(rc)) &&
        cardColors.every(cc => requestedColors.includes(cc) || cc === "C")
      );
    }
    if (op === ">=") return requestedColors.every(rc => cardColors.includes(rc));
    if (op === ">") return requestedColors.every(rc => cardColors.includes(rc)) && cardColors.length > requestedColors.length;
    if (op === "<=") return cardColors.every(cc => requestedColors.includes(cc) || cc === "C");
    if (op === "<") return cardColors.every(cc => requestedColors.includes(cc) || cc === "C") && cardColors.length < requestedColors.length;
    return requestedColors.some(rc => cardColors.includes(rc));
  };
}

function buildNumericFilter(getValue: (card: Card) => number | null, op: string, val: number): FilterFn {
  return (card: Card) => {
    const v = getValue(card);
    if (v === null || v === undefined) return false;
    if (op === "=" || op === ":") return v === val;
    if (op === ">") return v > val;
    if (op === ">=") return v >= val;
    if (op === "<") return v < val;
    if (op === "<=") return v <= val;
    if (op === "!=") return v !== val;
    return v === val;
  };
}

function buildTextFilter(getValue: (card: Card) => string, op: string, val: string): FilterFn {
  const lower = val.toLowerCase();
  return (card: Card) => {
    const s = getValue(card).toLowerCase();
    if (op === "=" ) return s === lower;
    return s.includes(lower);
  };
}

function tokenize(query: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < query.length) {
    if (query[i] === " " || query[i] === "\t") { i++; continue; }
    if (query[i] === "(" || query[i] === ")") { tokens.push(query[i]); i++; continue; }
    if (query.slice(i, i + 3).toUpperCase() === "AND") { tokens.push("AND"); i += 3; continue; }
    if (query.slice(i, i + 2).toUpperCase() === "OR") { tokens.push("OR"); i += 2; continue; }
    if (query.slice(i, i + 3).toUpperCase() === "NOT") { tokens.push("NOT"); i += 3; continue; }

    if (query[i] === "-" && (i === 0 || [" ", "(", "AND", "OR", "NOT"].some(s => query.slice(i - s.length, i) === s) )) {
      tokens.push("-");
      i++;
      continue;
    }

    let token = "";
    while (i < query.length && query[i] !== " " && query[i] !== "(" && query[i] !== ")") {
      if (query[i] === '"') {
        i++;
        while (i < query.length && query[i] !== '"') { token += query[i]; i++; }
        i++;
      } else {
        token += query[i];
        i++;
      }
    }
    if (token) tokens.push(token);
  }
  return tokens;
}

function parseToken(token: string): FilterFn {
  const opMatch = token.match(/^([a-zA-Z]+)([:=<>!]+)(.+)$/);
  if (!opMatch) {
    const lower = token.toLowerCase();
    return (card: Card) => card.name.toLowerCase().includes(lower);
  }

  const [, field, op, rawVal] = opMatch;
  const val = rawVal.replace(/^"|"$/g, "");
  const fieldLower = field.toLowerCase();

  if (fieldLower === "c" || fieldLower === "color" || fieldLower === "colour") {
    return buildColorFilter(op, val);
  }
  if (fieldLower === "id" || fieldLower === "identity" || fieldLower === "ci") {
    return buildColorFilter(op, val, true);
  }
  if (fieldLower === "t" || fieldLower === "type") {
    return buildTextFilter(c => c.typeLine || "", op, val);
  }
  if (fieldLower === "o" || fieldLower === "oracle" || fieldLower === "text") {
    return buildTextFilter(c => c.oracleText || "", op, val);
  }
  if (fieldLower === "r" || fieldLower === "rarity") {
    const mapped = RARITY_MAP[val.toLowerCase()] || val.toLowerCase();
    return (card: Card) => (card.rarity || "").toLowerCase() === mapped;
  }
  if (fieldLower === "s" || fieldLower === "set") {
    if (val.toLowerCase() === "all") return () => true;
    return (card: Card) => (card.code || "").toLowerCase() === val.toLowerCase();
  }
  if (fieldLower === "cmc" || fieldLower === "mv" || fieldLower === "manavalue") {
    const numVal = parseFloat(val);
    if (isNaN(numVal)) return () => true;
    return buildNumericFilter(c => c.cmc ?? null, op, numVal);
  }
  if (fieldLower === "name" || fieldLower === "n") {
    return buildTextFilter(c => c.name || "", op, val);
  }
  if (fieldLower === "a" || fieldLower === "artist") {
    return buildTextFilter(c => c.artist || "", op, val);
  }
  if (fieldLower === "pow" || fieldLower === "power") {
    const numVal = parseFloat(val);
    if (!isNaN(numVal)) return buildNumericFilter(c => parseFloat(c.power || "") || null, op, numVal);
    return buildTextFilter(c => c.power || "", op, val);
  }
  if (fieldLower === "tou" || fieldLower === "toughness") {
    const numVal = parseFloat(val);
    if (!isNaN(numVal)) return buildNumericFilter(c => parseFloat(c.toughness || "") || null, op, numVal);
    return buildTextFilter(c => c.toughness || "", op, val);
  }
  if (fieldLower === "is") {
    const v = val.toLowerCase();
    if (v === "foil") return (card: Card) => !!card.foil;
    if (v === "nonfoil") return (card: Card) => !!card.nonfoil;
    if (v === "fullart" || v === "full-art") return (card: Card) => !!card.fullArt;
    if (v === "promo") return (card: Card) => !!card.promo;
    if (v === "reprint") return (card: Card) => !!card.reprint;
    if (v === "digital") return (card: Card) => !!card.digital;
    return () => true;
  }
  if (fieldLower === "border") {
    return (card: Card) => (card.borderColor || "").toLowerCase() === val.toLowerCase();
  }
  if (fieldLower === "frame") {
    const lower = val.toLowerCase();
    return (card: Card) => {
      const fe = (card.frameEffects as string[] | null) || [];
      return fe.some(f => f.toLowerCase().includes(lower));
    };
  }
  if (fieldLower === "keyword") {
    const lower = val.toLowerCase();
    return (card: Card) => {
      const kw = (card.keywords as string[] | null) || [];
      return kw.some(k => k.toLowerCase().includes(lower));
    };
  }

  return () => true;
}

interface ParseResult {
  filter: FilterFn;
  errors: string[];
}

function parseExpression(tokens: string[], pos: { i: number }): FilterFn {
  let left = parsePrimary(tokens, pos);

  while (pos.i < tokens.length) {
    const tok = tokens[pos.i];
    if (tok === "OR") {
      pos.i++;
      const right = parsePrimary(tokens, pos);
      const prevLeft = left;
      left = (card: Card) => prevLeft(card) || right(card);
    } else if (tok === "AND" || (tok !== ")" && !["OR", "AND", "(", ")"].includes(tok))) {
      if (tok === "AND") pos.i++;
      const right = parsePrimary(tokens, pos);
      const prevLeft = left;
      left = (card: Card) => prevLeft(card) && right(card);
    } else {
      break;
    }
  }

  return left;
}

function parsePrimary(tokens: string[], pos: { i: number }): FilterFn {
  if (pos.i >= tokens.length) return () => true;

  if (tokens[pos.i] === "-") {
    pos.i++;
    const inner = parsePrimary(tokens, pos);
    return (card: Card) => !inner(card);
  }

  if (tokens[pos.i] === "NOT") {
    pos.i++;
    const inner = parsePrimary(tokens, pos);
    return (card: Card) => !inner(card);
  }

  if (tokens[pos.i] === "(") {
    pos.i++;
    const inner = parseExpression(tokens, pos);
    if (pos.i < tokens.length && tokens[pos.i] === ")") pos.i++;
    return inner;
  }

  if (tokens[pos.i] === "AND" || tokens[pos.i] === "OR" || tokens[pos.i] === ")") {
    return () => true;
  }

  const token = tokens[pos.i];
  pos.i++;
  return parseToken(token);
}

export function parseScryfallQuery(query: string): ParseResult {
  const trimmed = query.trim();
  if (!trimmed) return { filter: () => true, errors: [] };

  try {
    const tokens = tokenize(trimmed);
    if (tokens.length === 0) return { filter: () => true, errors: [] };
    const pos = { i: 0 };
    const filter = parseExpression(tokens, pos);
    return { filter, errors: [] };
  } catch (e: any) {
    return { filter: () => true, errors: [e.message || "Parse error"] };
  }
}

export function filterCards(cards: Card[], query: string): Card[] {
  if (!query.trim()) return cards;
  const { filter } = parseScryfallQuery(query);
  return cards.filter(filter);
}

export function validateScryfallQuery(query: string): string[] {
  if (!query.trim()) return [];
  const { errors } = parseScryfallQuery(query);
  return errors;
}
