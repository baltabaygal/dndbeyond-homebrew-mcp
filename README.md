# D&D Beyond Homebrew MCP Server (v1.0.0)

An advanced Model Context Protocol (MCP) server that empowers AI assistants to create and fully automate homebrew content (**Magic Items, Feats, Subclasses, Modifiers, Charges, Rest Resets, Spells**) directly inside your **D&D Beyond** account.

---

## ⚡ What this does
Unlike standard homebrew tools that only write visual description text, this server programs D&D Beyond's **underlying character-sheet calculation engines**:

1. **Automatic Stat & Speed Calculations**: Adds direct bonuses to AC, swimming/flying speed, saving throws, attack rolls, and damage.
2. **Proficiencies & Resistances**: Automatically checks proficiency circles (skills, armor, weapons) and applies damage resistances (e.g. Cold, Fire, Necrotic).
3. **Charges & Usage Limit Checkboxes**: Automatically configures limited uses with rest resets (`Short Rest`, `Long Rest`, `Dawn`, `Consumable`).
4. **Interactive Spellcasting**: Attaches spells from D&D Beyond's spell database to items with charge costs and save DCs.

---

## 🚀 Quick Setup

### 1. Install Dependencies
```bash
git clone https://github.com/baltabaygal/dndbeyond-homebrew-mcp.git
cd dndbeyond-homebrew-mcp
npm install
```

### 2. Connect Your D&D Beyond Account (One-Time)
```bash
npm run auth
```
* Uses your local Google Chrome app (`/Applications/Google Chrome.app`) to open the D&D Beyond login page.
* Once logged in, your session is securely captured to `~/.dndbeyond-homebrew/session.json`.

---

## 🤖 MCP Client Configuration

Add this to your MCP settings configuration (`mcp_config.json`, Claude Desktop, or Antigravity):

```json
{
  "mcpServers": {
    "dndbeyond-homebrew": {
      "command": "node",
      "args": ["/path/to/dndbeyond-homebrew-mcp/dist/server.js"],
      "env": {
        "HEADLESS": "true"
      }
    }
  }
}
```

---

## 🛠️ MCP Tools & Capabilities

### `create_homebrew_magic_item`
Creates an item shell and automatically injects all mechanical sub-forms:

* **Basic Info**: `name`, `rarity`, `itemType`, `requiresAttunement`, `attunementDescription`, `description`, `snippet`, `notes`
* **Charges & Limits (`charges`)**:
  * `count`: Total uses/charges (e.g., `1`, `3`, `7`)
  * `resetCondition`: `"Short Rest"` | `"Long Rest"` | `"Dawn"` | `"Consumable"` | `"Other"`
  * `resetDescription`: e.g. `"Regains 1 charge after a short or long rest."`
* **Programmatic Modifiers (`modifiers`)**:
  * `type`: `"Bonus"` | `"Damage"` | `"Advantage"` | `"Disadvantage"` | `"Resistance"` | `"Immunity"` | `"Vulnerability"` | `"Sense"` | `"Set"` | `"Proficiency"` | `"Language"` | `"Expertise"`
  * `subType`: `"Armor Class"`, `"Speed (Swimming)"`, `"Saving Throws"`, `"Athletics"`, `"Fire"`, `"Darkvision"`, etc.
  * `fixedValue`: number (e.g., `1` for +1 AC, `10` for +10 ft speed, `60` for 60 ft darkvision)
  * `diceCount` & `diceValue`: (e.g. `1` and `6` for +1d6 fire damage)
  * `stat`: `"STR"` | `"DEX"` | `"CON"` | `"INT"` | `"WIS"` | `"CHA"`
* **Attached Spells (`spells`)**:
  * `spellName`: Exact or partial name (e.g., `"Create or Destroy Water"`, `"Misty Step"`, `"Shield"`)
  * `charges`: Charges consumed per cast
  * `saveDc`: Fixed DC (or omit to use player's DC)
  * `restriction`: e.g. `"1/day"`

### `create_homebrew_spell`
Creates a complete spell with school, casting time, activation (Action/Bonus Action/Reaction), components, range, and upcasting descriptions.

### `create_homebrew_feat`
Creates a homebrew feat with prerequisites, dynamic snippet codes, and automated character sheet modifiers (ability score bonuses, twin cap breaks, resistances, senses, and skill proficiencies).

### `create_homebrew_subclass`
Creates a homebrew subclass for any 5e class (Barbarian, Bard, Cleric, Druid, Fighter, Monk, Paladin, Ranger, Rogue, Sorcerer, Warlock, Wizard, Artificer) with:
* Milestone level features matching official 5e level gaps.
* Automatic "Dummy Feature" backfilling to guarantee D&D Beyond validation passes.
* Programmatic modifiers attached to specific class milestone features with cap breaks.
* Automatic "Save Button Trick" execution to compile the top-level subclass calculation cache.

### `check_dndbeyond_auth`
Verifies if your session is active.

---

## 🔮 Example AI Usage

> *"Create a Rare attunement ring called the 'Ring of the Coral Tide' that gives +10 ft swimming speed, resistance to Cold damage, and allows casting Create or Destroy Water once per day resetting at dawn. Save it directly to my D&D Beyond homebrew."*

The AI calls `create_homebrew_magic_item` with the full mechanical specification:
1. Creates the item shell.
2. Configures the charge tracker (1 charge, resets on Dawn).
3. Injects the Speed modifier (+10 ft swimming speed).
4. Injects the Cold resistance modifier.
5. Injects the `Create or Destroy Water` spell link.
6. Returns the live D&D Beyond URL ready to equip on any character sheet!
