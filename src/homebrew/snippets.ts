/**
 * Reference and helper utilities based on IamSposta's "A Homebrewers' How-To FAQ"
 * and "Creating Subclasses Guide" on D&D Beyond.
 */

// 1. D&D Beyond Subclass Level Milestones
export const SUBCLASS_LEVELS: Record<string, number[]> = {
  Artificer: [3, 5, 9, 15],
  Barbarian: [3, 6, 10, 14],
  Bard: [3, 6, 14],
  Cleric: [1, 2, 6, 8, 17],
  Druid: [3, 6, 10, 14], // Standardized modern validator levels
  Fighter: [3, 7, 10, 15, 18],
  Monk: [3, 6, 11, 17],
  Paladin: [3, 7, 15, 20],
  Ranger: [3, 7, 11, 15],
  Rogue: [3, 9, 13, 17],
  Sorcerer: [1, 6, 14, 18],
  Warlock: [1, 6, 10, 14],
  Wizard: [2, 6, 10, 14],
};

// 2. Common Conditions for automatic tooltip formatting
export const CONDITIONS = [
  "blinded",
  "charmed",
  "deafened",
  "exhaustion",
  "frightened",
  "grappled",
  "incapacitated",
  "invisible",
  "paralyzed",
  "petrified",
  "poisoned",
  "prone",
  "restrained",
  "stunned",
  "unconscious",
];

// 3. Common Senses
export const SENSES = [
  "darkvision",
  "blindsight",
  "tremorsight",
  "truesight",
];

/**
 * Automatically wraps 5e terms with D&D Beyond BBCode tooltips:
 * - [condition]poisoned[/condition]
 * - [sense]darkvision[/sense]
 * - Converts *Spell Name* to [spell]Spell Name[/spell]
 */
export function formatTooltips(text: string, attachedSpells?: string[]): string {
  let formatted = text;

  // Convert italicized spell titles (e.g. *Misty Step* or *Thunderwave*) to [spell]...[/spell]
  formatted = formatted.replace(/\*([A-Za-z0-9\s/'-]+)\*/g, (match, inner) => {
    const trimmed = inner.trim();
    // Don't wrap bold tags or headers like **Quick as Lightning:**
    if (trimmed.length > 2 && !trimmed.startsWith("*") && !trimmed.includes(":")) {
      return `[spell]${trimmed}[/spell]`;
    }
    return match;
  });

  // Also wrap any explicitly attached spells if not already wrapped
  if (attachedSpells) {
    for (const spell of attachedSpells) {
      const reg = new RegExp(`(?<!\\[spell\\])\\b(${spell})\\b(?!\\[\\/spell\\])`, "gi");
      formatted = formatted.replace(reg, "[spell]$1[/spell]");
    }
  }

  // Conditions
  for (const cond of CONDITIONS) {
    const reg = new RegExp(`(?<!\\[condition\\])\\b(${cond})\\b(?!\\[\\/condition\\])`, "gi");
    formatted = formatted.replace(reg, "[condition]$1[/condition]");
  }

  // Senses
  for (const sense of SENSES) {
    const reg = new RegExp(`(?<!\\[sense\\])\\b(${sense})\\b(?!\\[\\/sense\\])`, "gi");
    formatted = formatted.replace(reg, "[sense]$1[/sense]");
  }

  return formatted;
}

/**
 * Common D&D Beyond Snippet calculation codes:
 * - {{savedc:cha}} -> Live Spell Save DC
 * - {{modifier:dex}} -> Live Ability Modifier (e.g. +3)
 * - {{proficiency}} -> Live Proficiency Bonus
 * - {{classlevel}} -> Class level
 * - {{scalevalue}} -> Level scaling die or value
 */
export const SNIPPET_CHEAT_SHEET = {
  saveDc: (stat: "str" | "dex" | "con" | "int" | "wis" | "cha") => `{{savedc:${stat}}}`,
  modifier: (stat: "str" | "dex" | "con" | "int" | "wis" | "cha") => `{{modifier:${stat}}}`,
  modifierSigned: (stat: "str" | "dex" | "con" | "int" | "wis" | "cha") => `{{modifier:${stat}#signed}}`,
  proficiency: "{{proficiency}}",
  classLevel: "{{classlevel}}",
  characterLevel: "{{characterlevel}}",
  scaleValue: "{{scalevalue}}",
  halfLevelRoundDown: "{{(classlevel/2)@rounddown}}",
};
