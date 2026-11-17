import { ModifierInput, ModifierType, ResetCondition } from "../types.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

export const MODIFIER_TYPE_IDS: Record<ModifierType, string> = {
  Bonus: "1",
  Damage: "2",
  Advantage: "3",
  Disadvantage: "4",
  Resistance: "5",
  Immunity: "6",
  Vulnerability: "7",
  Sense: "8",
  Set: "9",
  Proficiency: "10",
  Language: "11",
  Expertise: "12",
  "Half Proficiency": "13",
  Feat: "14",
};

export const RESET_CONDITION_IDS: Record<ResetCondition, string> = {
  "Short Rest": "1",
  "Long Rest": "2",
  Dawn: "3",
  Consumable: "4",
  Other: "5",
};

export const STAT_IDS: Record<string, string> = {
  STR: "1",
  DEX: "2",
  CON: "3",
  INT: "4",
  WIS: "5",
  CHA: "6",
};

// Common alias redirects
export const SUBTYPE_ALIASES: Record<string, string> = {
  str: "Strength Score",
  strength: "Strength Score",
  dex: "Dexterity Score",
  dexterity: "Dexterity Score",
  con: "Constitution Score",
  constitution: "Constitution Score",
  int: "Intelligence Score",
  intelligence: "Intelligence Score",
  wis: "Wisdom Score",
  wisdom: "Wisdom Score",
  cha: "Charisma Score",
  charisma: "Charisma Score",
  ac: "Armor Class",
  "walking speed": "Speed (Walking)",
  "swimming speed": "Speed (Swimming)",
  "flying speed": "Speed (Flying)",
  "climbing speed": "Speed (Climbing)",
  "burrowing speed": "Speed (Burrowing)",
};

// Verified official D&D Beyond subtype IDs
export const COMMON_SUBTYPES: Record<string, { id: string; typeId: string }> = {
  // Armor Class
  "armor class": { id: "1", typeId: "1" },
  "ac": { id: "1", typeId: "1" },
  "unarmored armor class": { id: "801", typeId: "1" },
  "armored armor class": { id: "806", typeId: "1" },

  // Ability Scores (Type 1 Bonus)
  "strength": { id: "2", typeId: "1" },
  "strength score": { id: "2", typeId: "1" },
  "dexterity": { id: "3", typeId: "1" },
  "dexterity score": { id: "3", typeId: "1" },
  "constitution": { id: "4", typeId: "1" },
  "constitution score": { id: "4", typeId: "1" },
  "intelligence": { id: "5", typeId: "1" },
  "intelligence score": { id: "5", typeId: "1" },
  "wisdom": { id: "6", typeId: "1" },
  "wisdom score": { id: "6", typeId: "1" },
  "charisma": { id: "7", typeId: "1" },
  "charisma score": { id: "7", typeId: "1" },

  // Ability Score Maximum (Cap Break)
  "ability score maximum": { id: "848", typeId: "1" },

  // Speeds (Type 1 Bonus)
  "speed": { id: "40", typeId: "1" },
  "speed (swimming)": { id: "43", typeId: "1" },
  "swimming speed": { id: "43", typeId: "1" },
  "speed (flying)": { id: "41", typeId: "1" },
  "flying speed": { id: "41", typeId: "1" },
  "speed (climbing)": { id: "42", typeId: "1" },
  "speed (burrowing)": { id: "44", typeId: "1" },
  "speed (walking)": { id: "1697", typeId: "1" },
  "walking speed": { id: "1697", typeId: "1" },

  // Initiative & Saves
  "initiative": { id: "218", typeId: "1" },
  "saving throws": { id: "8", typeId: "1" },
  "strength saving throws": { id: "9", typeId: "1" },
  "dexterity saving throws": { id: "10", typeId: "1" },
  "constitution saving throws": { id: "11", typeId: "1" },
  "intelligence saving throws": { id: "12", typeId: "1" },
  "wisdom saving throws": { id: "13", typeId: "1" },
  "charisma saving throws": { id: "14", typeId: "1" },
  "death saving throws": { id: "1690", typeId: "3" },

  // Proficiencies - Skills (Type 10)
  "acrobatics": { id: "237", typeId: "10" },
  "animal handling": { id: "245", typeId: "10" },
  "arcana": { id: "240", typeId: "10" },
  "athletics": { id: "236", typeId: "10" },
  "deception": { id: "249", typeId: "10" },
  "history": { id: "239", typeId: "10" },
  "insight": { id: "244", typeId: "10" },
  "intimidation": { id: "250", typeId: "10" },
  "investigation": { id: "241", typeId: "10" },
  "medicine": { id: "246", typeId: "10" },
  "nature": { id: "242", typeId: "10" },
  "perception": { id: "247", typeId: "10" },
  "performance": { id: "251", typeId: "10" },
  "persuasion": { id: "252", typeId: "10" },
  "religion": { id: "243", typeId: "10" },
  "sleight of hand": { id: "238", typeId: "10" },
  "stealth": { id: "248", typeId: "10" },
  "survival": { id: "248", typeId: "10" },

  // Resistances (Type 5)
  "acid": { id: "131", typeId: "5" },
  "cold": { id: "133", typeId: "5" },
  "fire": { id: "134", typeId: "5" },
  "force": { id: "135", typeId: "5" },
  "lightning": { id: "136", typeId: "5" },
  "necrotic": { id: "137", typeId: "5" },
  "poison": { id: "138", typeId: "5" },
  "psychic": { id: "139", typeId: "5" },
  "radiant": { id: "140", typeId: "5" },
  "thunder": { id: "141", typeId: "5" },

  // Senses (Type 8)
  "darkvision": { id: "171", typeId: "8" },
  "blindsight": { id: "170", typeId: "8" },
  "truesight": { id: "173", typeId: "8" },
  "tremorsight": { id: "172", typeId: "8" },
};

// Full D&D Beyond 1,657 modifier database loader
let cachedFullDb: Array<{ id: number; name: string; type: number }> | null = null;
function getFullDb(): Array<{ id: number; name: string; type: number }> {
  if (cachedFullDb) return cachedFullDb;
  try {
    const curDir = path.dirname(fileURLToPath(import.meta.url));
    const pathsToTry = [
      path.join(curDir, "dndbeyond-subtypes.json"),
      path.join(curDir, "../../dndbeyond-subtypes.json"),
      path.join(process.cwd(), "dndbeyond-subtypes.json"),
    ];
    for (const p of pathsToTry) {
      if (fs.existsSync(p)) {
        cachedFullDb = JSON.parse(fs.readFileSync(p, "utf-8"));
        return cachedFullDb!;
      }
    }
  } catch (err) {
    // fallback
  }
  return [];
}

export function resolveModifier(
  type: ModifierType,
  subTypeName: string
): { typeId: string; subTypeId?: string; subTypeName?: string } {
  const typeId = MODIFIER_TYPE_IDS[type] || "1";
  const numTypeId = parseInt(typeId, 10);
  let clean = subTypeName.trim().toLowerCase();

  // Alias resolution
  if (SUBTYPE_ALIASES[clean]) {
    clean = SUBTYPE_ALIASES[clean].toLowerCase();
  }

  // 1. Direct verified dictionary lookup
  const exact = COMMON_SUBTYPES[clean];
  if (exact) {
    return { typeId, subTypeId: exact.id, subTypeName };
  }

  // 2. Query full official 1,657 D&D Beyond database
  const db = getFullDb();
  if (db.length > 0) {
    // Exact match for type
    const exactDb = db.find((e) => e.type === numTypeId && e.name.toLowerCase() === clean);
    if (exactDb) {
      return { typeId, subTypeId: String(exactDb.id), subTypeName: exactDb.name };
    }

    // Starts-with match
    const startsDb = db.find((e) => e.type === numTypeId && e.name.toLowerCase().startsWith(clean));
    if (startsDb) {
      return { typeId, subTypeId: String(startsDb.id), subTypeName: startsDb.name };
    }

    // Includes match
    const includesDb = db.find((e) => e.type === numTypeId && e.name.toLowerCase().includes(clean));
    if (includesDb) {
      return { typeId, subTypeId: String(includesDb.id), subTypeName: includesDb.name };
    }
  }

  // 3. Fallback to common subtypes search
  for (const [key, val] of Object.entries(COMMON_SUBTYPES)) {
    if (val.typeId === typeId && (clean.includes(key) || key.includes(clean))) {
      return { typeId, subTypeId: val.id, subTypeName };
    }
  }

  return { typeId, subTypeName };
}

/**
 * Universal D&D Beyond 20-Stat Cap Break Expander.
 * In D&D Beyond, any entity (Item, Feat, Subclass, Species) that increases an ability score
 * must also have a twin 'Bonus -> Ability Score Maximum' modifier attached, otherwise
 * the character sheet caps the stat at 20 regardless of bonuses.
 */
export function expandModifiersWithCapBreak(modifiers: ModifierInput[]): ModifierInput[] {
  const result: ModifierInput[] = [];
  const statRegex = /^(strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha)/i;

  for (const mod of modifiers) {
    result.push(mod);

    if (mod.type === "Bonus" && mod.fixedValue && !mod.subType.toLowerCase().includes("maximum")) {
      const match = mod.subType.match(statRegex);
      if (match) {
        const raw = match[1].toLowerCase();
        let statKey: "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA" = "STR";
        if (raw.startsWith("str")) statKey = "STR";
        else if (raw.startsWith("dex")) statKey = "DEX";
        else if (raw.startsWith("con")) statKey = "CON";
        else if (raw.startsWith("int")) statKey = "INT";
        else if (raw.startsWith("wis")) statKey = "WIS";
        else if (raw.startsWith("cha")) statKey = "CHA";

        const hasCap = modifiers.some(
          (m) =>
            m.type === "Bonus" &&
            m.subType.toLowerCase().includes("maximum") &&
            m.stat === statKey
        );

        if (!hasCap) {
          result.push({
            type: "Bonus",
            subType: "Ability Score Maximum",
            fixedValue: mod.fixedValue,
            stat: statKey,
          });
        }
      }
    }
  }
  return result;
}
