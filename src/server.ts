import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createMagicItem } from "./homebrew/magic-item.js";
import { createSpell } from "./homebrew/spell.js";
import { createFeat } from "./homebrew/feat.js";
import { createSubclass } from "./homebrew/subclass.js";
import { hasSavedSession, SESSION_FILE } from "./auth.js";
import { MagicItemInput, SpellInput, FeatInput, SubclassInput } from "./types.js";

// Initialize MCP Server
const server = new McpServer({
  name: "dndbeyond-homebrew-mcp",
  version: "1.0.0",
});

// 1. Auth Status Tool
server.tool(
  "check_dndbeyond_auth",
  "Check whether D&D Beyond session cookies are configured and valid for creating homebrew.",
  {},
  async () => {
    const isConfigured = hasSavedSession();
    if (!isConfigured) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Not authenticated with D&D Beyond.\n\nTo authenticate:\n1. Run 'npm run auth' in your terminal to log in via browser window, or\n2. Set COBALT_SESSION=<your_cookie> in your environment or .env file.\nSession path expected: ${SESSION_FILE}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `✅ Authenticated! Session configuration found at: ${SESSION_FILE}\nYou are ready to create homebrew with full automated mechanics (modifiers, charges, attached spells) on D&D Beyond.`,
        },
      ],
    };
  }
);

// 2. Create Magic Item Tool
server.tool(
  "create_homebrew_magic_item",
  "Creates a new homebrew magic item directly on D&D Beyond with automated character-sheet mechanics (modifiers, charges, rest resets, and attached spells).",
  {
    name: z.string().describe("The name of the magic item"),
    rarity: z
      .enum(["Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact"])
      .describe("The rarity tier of the magic item"),
    itemType: z
      .enum([
        "Armor",
        "Potion",
        "Ring",
        "Rod",
        "Scroll",
        "Staff",
        "Wand",
        "Weapon",
        "Wondrous Item",
      ])
      .describe("The base category of the magic item"),
    requiresAttunement: z
      .boolean()
      .describe("Whether this item requires attunement to use"),
    attunementDescription: z
      .string()
      .optional()
      .describe("Optional condition for attunement, e.g. 'by a spellcaster'"),
    description: z
      .string()
      .describe("Full lore and mechanical description of the magic item"),
    snippet: z
      .string()
      .optional()
      .describe(
        "Short summary snippet displayed on character sheets. You can use dynamic D&D Beyond snippet codes like {{savedc:cha}}, {{modifier:str}}, {{proficiency}}, or {{scalevalue}}."
      ),
    template: z
      .string()
      .optional()
      .describe(
        "Optional name of an official D&D item to clone as a baseline (e.g. 'Ring of Protection', 'Flame Tongue', 'Sun Blade'). D&D Beyond will copy its baseline mechanics."
      ),
    notes: z.string().optional().describe("Internal or DM notes"),
    charges: z
      .object({
        count: z.number().int().min(1).describe("Total number of charges or limited uses"),
        resetCondition: z
          .enum(["Short Rest", "Long Rest", "Dawn", "Consumable", "Other"])
          .describe("When the charges recharge on the character sheet"),
        resetDescription: z
          .string()
          .optional()
          .describe("Text explaining the recharge mechanic, e.g. 'Regains 1 charge after a long rest'"),
      })
      .optional()
      .describe("Limited use and charges configuration that adds checkboxes on the character sheet"),
    modifiers: z
      .array(
        z.object({
          type: z
            .enum([
              "Bonus",
              "Damage",
              "Advantage",
              "Disadvantage",
              "Resistance",
              "Immunity",
              "Vulnerability",
              "Sense",
              "Set",
              "Proficiency",
              "Language",
              "Expertise",
            ])
            .describe("Modifier category that alters character sheet calculations"),
          subType: z
            .string()
            .describe(
              "What is modified, e.g. 'Armor Class', 'Speed (Swimming)', 'Saving Throws', 'Athletics', 'Fire', 'Initiative'"
            ),
          fixedValue: z
            .number()
            .optional()
            .describe("Flat numerical bonus or set value (e.g. 1 for +1 AC, 10 for +10 ft speed)"),
          diceCount: z.number().optional().describe("Number of dice if damage/bonus uses dice"),
          diceValue: z.number().optional().describe("Die size (4, 6, 8, 10, 12, 20)"),
          stat: z.enum(["STR", "DEX", "CON", "INT", "WIS", "CHA"]).optional().describe("Target ability score"),
        })
      )
      .optional()
      .describe(
        "List of programmatic modifiers that automatically calculate stats and proficiencies on character sheets"
      ),
    spells: z
      .array(
        z.object({
          spellName: z.string().describe("Exact name of the spell, e.g. 'Create or Destroy Water', 'Misty Step', 'Fireball'"),
          charges: z.number().optional().describe("Number of charges consumed when cast"),
          saveDc: z.number().optional().describe("Fixed save DC (omit to use caster's DC)"),
          castAtLevel: z.number().optional().describe("Spell slot level if upcast"),
          restriction: z.string().optional().describe("Usage restriction, e.g. '1/day'"),
        })
      )
      .optional()
      .describe("Spells attached to this item that can be cast directly from the character sheet"),
  },
  async (args) => {
    if (!hasSavedSession()) {
      return {
        content: [
          {
            type: "text",
            text: "❌ Error: D&D Beyond session not found. Please run 'npm run auth' first.",
          },
        ],
      };
    }

    const input: MagicItemInput = {
      name: args.name,
      rarity: args.rarity,
      itemType: args.itemType,
      requiresAttunement: args.requiresAttunement,
      attunementDescription: args.attunementDescription,
      description: args.description,
      snippet: args.snippet,
      template: args.template,
      notes: args.notes,
      charges: args.charges as any,
      modifiers: args.modifiers as any,
      spells: args.spells as any,
    };

    const result = await createMagicItem(input);

    if (!result.success) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Failed to create magic item "${args.name}": ${result.error}`,
          },
        ],
      };
    }

    const details = result.details || {};
    const modSummary = details.addedModifiersCount ? `\n⚙️ Modifiers Attached: ${details.addedModifiersCount}` : "";
    const spellSummary = details.addedSpellsCount ? `\n📜 Spells Attached: ${details.addedSpellsCount}` : "";
    const chargeSummary = details.charges ? `\n⚡ Charges: ${details.charges.count} (Resets on ${details.charges.resetCondition})` : "";

    return {
      content: [
        {
          type: "text",
          text: `🎉 Successfully created magic item "${result.name}" on D&D Beyond!\n\n🔗 URL: ${result.url}\n🆔 ID: ${result.id || "N/A"}\n✨ Rarity: ${args.rarity}\n🛡️ Type: ${args.itemType}\n🔮 Requires Attunement: ${args.requiresAttunement ? "Yes" : "No"}${chargeSummary}${modSummary}${spellSummary}\n\nAll sheet mechanics (charges, modifiers, spells) have been configured automatically!`,
        },
      ],
    };
  }
);

// 3. Create Spell Tool
server.tool(
  "create_homebrew_spell",
  "Creates a new homebrew spell directly on D&D Beyond and returns its URL.",
  {
    name: z.string().describe("The name of the spell"),
    level: z
      .number()
      .int()
      .min(0)
      .max(9)
      .describe("Spell level: 0 for Cantrip, 1 to 9 for leveled spells"),
    school: z
      .enum([
        "Abjuration",
        "Conjuration",
        "Divination",
        "Enchantment",
        "Evocation",
        "Illusion",
        "Necromancy",
        "Transmutation",
      ])
      .describe("School of magic"),
    activation: z
      .enum(["Action", "Bonus Action", "Reaction", "Minute", "Hour"])
      .optional()
      .describe("Action type to cast the spell"),
    castingTimeNumber: z.number().int().optional().describe("Number of actions/minutes/hours, defaults to 1"),
    reactionCondition: z.string().optional().describe("Trigger condition if casting as a Reaction"),
    rangeDistance: z.string().optional().describe("Range or area (e.g. '60', 'Touch', 'Self')"),
    components: z
      .object({
        verbal: z.boolean().describe("Requires verbal (V) component"),
        somatic: z.boolean().describe("Requires somatic (S) component"),
        material: z.boolean().describe("Requires material (M) component"),
        materialsDescription: z
          .string()
          .optional()
          .describe("Description of required materials"),
      })
      .describe("Spell components"),
    durationText: z
      .string()
      .optional()
      .describe("Duration, e.g. 'Instantaneous', '1 minute', 'Concentration, up to 10 minutes'"),
    description: z
      .string()
      .describe("The full mechanical and flavor description of the spell"),
    atHigherLevels: z
      .string()
      .optional()
      .describe("Description of what happens when cast using a higher-level spell slot"),
  },
  async (args) => {
    if (!hasSavedSession()) {
      return {
        content: [
          {
            type: "text",
            text: "❌ Error: D&D Beyond session not found. Please run 'npm run auth' first.",
          },
        ],
      };
    }

    const input: SpellInput = {
      name: args.name,
      level: args.level,
      school: args.school,
      activation: args.activation,
      castingTimeNumber: args.castingTimeNumber,
      reactionCondition: args.reactionCondition,
      rangeDistance: args.rangeDistance,
      components: args.components,
      durationText: args.durationText,
      description: args.description,
      atHigherLevels: args.atHigherLevels,
    };

    const result = await createSpell(input);

    if (!result.success) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Failed to create spell "${args.name}": ${result.error}`,
          },
        ],
      };
    }

    const levelText = args.level === 0 ? "Cantrip" : `Level ${args.level}`;

    return {
      content: [
        {
          type: "text",
          text: `🎉 Successfully created spell "${result.name}" on D&D Beyond!\n\n🔗 URL: ${result.url}\n🆔 ID: ${result.id || "N/A"}\n📜 Level: ${levelText}\n✨ School: ${args.school}\n⏱️ Activation: ${args.activation || "Action"}\n🎯 Range: ${args.rangeDistance || "Self"}`,
        },
      ],
    };
  }
);

// 4. Create Feat Tool
server.tool(
  "create_homebrew_feat",
  "Creates a new homebrew feat directly on D&D Beyond with automated character-sheet mechanics (modifiers, stat bonuses, cap breaks, and snippets).",
  {
    name: z.string().describe("The name of the feat"),
    prerequisite: z.string().optional().describe("Prerequisites to take the feat, e.g. 'Strength 13 or higher'"),
    description: z.string().describe("Full lore and mechanical description of the feat"),
    snippet: z.string().optional().describe("Short summary snippet displayed on character sheets with dynamic snippet codes"),
    modifiers: z
      .array(
        z.object({
          type: z
            .enum([
              "Bonus",
              "Damage",
              "Advantage",
              "Disadvantage",
              "Resistance",
              "Immunity",
              "Vulnerability",
              "Sense",
              "Set",
              "Proficiency",
              "Language",
              "Expertise",
            ])
            .describe("Modifier category that alters character sheet calculations"),
          subType: z.string().describe("What is modified, e.g. 'Strength Score', 'Armor Class', 'Athletics', 'Fire', 'Speed (Walking)'"),
          fixedValue: z.number().optional().describe("Flat numerical bonus or set value"),
          stat: z.enum(["STR", "DEX", "CON", "INT", "WIS", "CHA"]).optional().describe("Target ability score"),
        })
      )
      .optional()
      .describe("Programmatic modifiers that automatically calculate stats and proficiencies on character sheets"),
  },
  async (args) => {
    if (!hasSavedSession()) {
      return {
        content: [
          {
            type: "text",
            text: "❌ Error: D&D Beyond session not found. Please run 'npm run auth' first.",
          },
        ],
      };
    }

    const input: FeatInput = {
      name: args.name,
      prerequisite: args.prerequisite,
      description: args.description,
      snippet: args.snippet,
      modifiers: args.modifiers as any,
    };

    const result = await createFeat(input);
    if (!result.success) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Failed to create feat "${args.name}": ${result.error}`,
          },
        ],
      };
    }

    const details = result.details || {};
    const modSummary = details.addedModifiersCount ? `\n⚙️ Modifiers Attached: ${details.addedModifiersCount}` : "";

    return {
      content: [
        {
          type: "text",
          text: `🎉 Successfully created feat "${result.name}" on D&D Beyond!\n\n🔗 URL: ${result.url}\n🆔 ID: ${result.id || "N/A"}${modSummary}\n\nAll sheet mechanics (modifiers, stat bonuses, cap breaks) have been configured and compiled into D&D Beyond's calculation cache!`,
        },
      ],
    };
  }
);

// 5. Create Subclass Tool
server.tool(
  "create_homebrew_subclass",
  "Creates a new homebrew subclass directly on D&D Beyond with milestone class features, dynamic snippets, and character-sheet modifiers.",
  {
    baseClass: z
      .enum([
        "Barbarian",
        "Bard",
        "Cleric",
        "Druid",
        "Fighter",
        "Monk",
        "Paladin",
        "Ranger",
        "Rogue",
        "Sorcerer",
        "Warlock",
        "Wizard",
        "Artificer",
        "Blood Hunter",
      ])
      .describe("The core class this subclass belongs to"),
    name: z.string().describe("The name of the subclass"),
    description: z.string().describe("Full lore and flavor description of the subclass"),
    shortDescription: z.string().optional().describe("Short 1-2 sentence summary"),
    features: z
      .array(
        z.object({
          name: z.string().describe("Feature name"),
          level: z.number().int().min(1).max(20).describe("Milestone level at which this feature is gained"),
          description: z.string().describe("Detailed feature description"),
          snippet: z.string().optional().describe("Snippet code for character sheet"),
          modifiers: z
            .array(
              z.object({
                type: z.enum([
                  "Bonus",
                  "Damage",
                  "Advantage",
                  "Disadvantage",
                  "Resistance",
                  "Immunity",
                  "Vulnerability",
                  "Sense",
                  "Set",
                  "Proficiency",
                  "Language",
                  "Expertise",
                ]),
                subType: z.string().describe("What is modified, e.g. 'Strength Score', 'Armor Class', 'Fire', 'Speed (Walking)'"),
                fixedValue: z.number().optional().describe("Flat numerical bonus"),
                stat: z.enum(["STR", "DEX", "CON", "INT", "WIS", "CHA"]).optional(),
              })
            )
            .optional(),
        })
      )
      .optional()
      .describe("Milestone features gained at appropriate subclass levels"),
  },
  async (args) => {
    if (!hasSavedSession()) {
      return {
        content: [
          {
            type: "text",
            text: "❌ Error: D&D Beyond session not found. Please run 'npm run auth' first.",
          },
        ],
      };
    }

    const input: SubclassInput = {
      baseClass: args.baseClass as any,
      name: args.name,
      description: args.description,
      shortDescription: args.shortDescription,
      features: args.features as any,
    };

    const result = await createSubclass(input);
    if (!result.success) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Failed to create subclass "${args.name}": ${result.error}`,
          },
        ],
      };
    }

    const details = result.details || {};
    const featSummary = details.addedFeaturesCount ? `\n📜 Class Features Added: ${details.addedFeaturesCount}` : "";
    const modSummary = details.addedModifiersCount ? `\n⚙️ Modifiers Attached: ${details.addedModifiersCount}` : "";

    return {
      content: [
        {
          type: "text",
          text: `🎉 Successfully created subclass "${result.name}" for ${args.baseClass} on D&D Beyond!\n\n🔗 URL: ${result.url}\n🆔 ID: ${result.id || "N/A"}${featSummary}${modSummary}\n\nMilestone features, modifiers, and D&D Beyond's calculation cache have been committed!`,
        },
      ],
    };
  }
);

// Connect via STDIO transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("D&D Beyond Homebrew MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting MCP server:", err);
  process.exit(1);
});
