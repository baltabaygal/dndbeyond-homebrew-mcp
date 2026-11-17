export type Rarity =
  | "Common"
  | "Uncommon"
  | "Rare"
  | "Very Rare"
  | "Legendary"
  | "Artifact";

export type MagicItemType =
  | "Armor"
  | "Potion"
  | "Ring"
  | "Rod"
  | "Scroll"
  | "Staff"
  | "Wand"
  | "Weapon"
  | "Wondrous Item";

export type ResetCondition =
  | "Short Rest"
  | "Long Rest"
  | "Dawn"
  | "Consumable"
  | "Other";

export interface ChargesInput {
  count: number;
  resetCondition: ResetCondition;
  resetDescription?: string;
}

export type ModifierType =
  | "Bonus"
  | "Damage"
  | "Advantage"
  | "Disadvantage"
  | "Resistance"
  | "Immunity"
  | "Vulnerability"
  | "Sense"
  | "Set"
  | "Proficiency"
  | "Language"
  | "Expertise"
  | "Half Proficiency"
  | "Feat";

export interface ModifierInput {
  type: ModifierType;
  subType: string; // e.g. "Armor Class", "Strength Score", "Speed (Walking)", "Athletics", "Fire", "Initiative"
  fixedValue?: number;
  diceCount?: number;
  diceValue?: 4 | 6 | 8 | 10 | 12 | 20;
  stat?: "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";
  requiresAttunement?: boolean;
}

export interface AttachedSpellInput {
  spellName: string; // e.g. "Create or Destroy Water", "Fireball"
  charges?: number;
  saveDc?: number;
  castAtLevel?: number;
  restriction?: string; // e.g. "1/day"
}

export interface MagicItemInput {
  name: string;
  rarity: Rarity;
  itemType: MagicItemType;
  requiresAttunement: boolean;
  attunementDescription?: string;
  description: string;
  snippet?: string;
  notes?: string;
  weight?: number;
  template?: string; // Optional official template to clone
  charges?: ChargesInput;
  modifiers?: ModifierInput[];
  spells?: AttachedSpellInput[];
}

export type SpellSchool =
  | "Abjuration"
  | "Conjuration"
  | "Divination"
  | "Enchantment"
  | "Evocation"
  | "Illusion"
  | "Necromancy"
  | "Transmutation";

export type SpellActivation =
  | "Action"
  | "Bonus Action"
  | "Reaction"
  | "Minute"
  | "Hour";

export interface SpellInput {
  name: string;
  level: number; // 0 for Cantrip, 1-9
  school: SpellSchool;
  activation?: SpellActivation;
  castingTimeNumber?: number;
  reactionCondition?: string;
  rangeDistance?: string; // e.g. "60", "Touch", "Self"
  components: {
    verbal: boolean;
    somatic: boolean;
    material: boolean;
    materialsDescription?: string;
  };
  durationText?: string; // e.g. "Instantaneous", "1 minute"
  concentration?: boolean;
  description: string;
  atHigherLevels?: string;
}

export interface FeatInput {
  name: string;
  prerequisite?: string;
  description: string;
  snippet?: string;
  modifiers?: ModifierInput[];
  spells?: AttachedSpellInput[];
}

export type BaseClass =
  | "Barbarian"
  | "Bard"
  | "Cleric"
  | "Druid"
  | "Fighter"
  | "Monk"
  | "Paladin"
  | "Ranger"
  | "Rogue"
  | "Sorcerer"
  | "Warlock"
  | "Wizard"
  | "Artificer"
  | "Blood Hunter";

export interface SubclassFeatureInput {
  name: string;
  level: number;
  description: string;
  snippet?: string;
  modifiers?: ModifierInput[];
  spells?: AttachedSpellInput[];
}

export interface SubclassInput {
  baseClass: BaseClass;
  name: string;
  description: string;
  shortDescription?: string;
  features?: SubclassFeatureInput[];
}

export interface HomebrewCreationResult {
  success: boolean;
  name: string;
  url?: string;
  id?: string;
  error?: string;
  details?: Record<string, any>;
}
