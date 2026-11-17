# D&D Beyond Homebrew MCP — Knowledge Base & Resources

A curated list of all the repositories, official design workshops, community masterclasses, and technical references used to build and optimize this MCP server.

---

## 1. Open-Source Repositories & Inspiration

* **[AlexWorland/dndbeyond-mcp](https://github.com/AlexWorland/dndbeyond-mcp)**
  * *Purpose:* TypeScript Model Context Protocol (MCP) server reference.
  * *Takeaway:* Inspired our automated browser authentication pattern via Playwright to securely capture the `CobaltSession` cookie into a local configuration file.
* **[astermoline/dndbeyond-parser](https://github.com/astermoline/dndbeyond-parser)**
  * *Purpose:* Zero-dependency TypeScript SDK for extracting and normalizing D&D Beyond data.
  * *Takeaway:* Great reference for D&D Beyond's internal JSON data models and character sheet structures.
* **[MrPrimate/ddb-importer](https://github.com/MrPrimate/ddb-importer)**
  * *Purpose:* Leading community importer tool connecting D&D Beyond characters, monsters, and items to Foundry VTT.
  * *Takeaway:* Reverse-engineering insights into D&D Beyond's endpoints and character-sheet modifier calculation logic.

---

## 2. Official D&D Beyond Design Workshop Guides

Authored by game designer **James Introcaso**, this editorial masterclass series provides the official balance and design frameworks for 5e content creation:

* **[D&D Beyond: Design Workshop Hub](https://www.dndbeyond.com/tag/design-workshop)**
  * Central archive of all official workshop articles.
* **[Design Workshop: Magic Items](https://www.dndbeyond.com/posts/382-design-workshop-magic-items)**
  * *Key Rules:* Attunement discipline (protecting bounded accuracy for flat bonuses and extra spell slots), charge economy, and rarity tier balance.
* **[Design Workshop: Spells](https://www.dndbeyond.com/posts/407-design-workshop-spells)**
  * *Key Rules:* Damage benchmarks by spell level, action economy (Action vs. Bonus Action budgeting), and Concentration requirements.
* **[Design Workshop: Monsters](https://www.dndbeyond.com/posts/397-design-workshop-monsters)**
  * *Key Rules:* Balancing Offensive CR (damage per round + attack bonus/DC) against Defensive CR (effective HP + AC).
* **[Design Workshop: Feats](https://www.dndbeyond.com/posts/419-design-workshop-feats)**
  * *Key Rules:* Designing features that properly balance against an Ability Score Improvement (+2 ASI).
* **[New Player's Guide: How to Homebrew on D&D Beyond](https://www.dndbeyond.com/posts/845-new-players-guide-how-to-homebrew-on-d-d-beyond)**
  * Official beginner walkthrough on navigating D&D Beyond's creation screens and campaign sharing.
* **[D&D Beyond Homebrew Hub](https://www.dndbeyond.com/homebrew)**
  * The main portal for accessing community-created homebrew and your personal collection.

---

## 3. Community Masterclasses & FAQs

* **[A Homebrewers’ “How-To” FAQ (by IamSposta)](https://www.dndbeyond.com/forums/dungeons-dragons-discussion/homebrew-house-rules/131411-a-homebrewers-how-to-faq)**
  * *The definitive D&D Beyond community bible.*
  * *Key Insights Incorporated:*
    * **Dynamic Snippets:** Using live calculation codes (`{{savedc:...}}`, `{{modifier:...}}`, `{{proficiency}}`) in snippet boxes rather than static numbers.
    * **Interactive Tooltips:** Formatting BBCode tags (`[spell]...[/spell]`, `[condition]...[/condition]`, `[sense]...[/sense]`).
    * **The 20-Minute Cache Delay:** Understanding D&D Beyond server caching and how to bypass it.
    * **Breaking the 20 Stat Cap:** Injecting `Ability Score Maximum` alongside `Bonus` modifiers.
* **[Creating Subclasses Guide (by Hartlessd20 & IamSposta)](https://www.dndbeyond.com/forums/dungeons-dragons-discussion/homebrew-house-rules/23242-creating-subclasses-guide)**
  * *Key Insights Incorporated:*
    * Exact subclass level gaps for all 12 classes + Artificer.
    * The **"Save Button" trick** to force D&D Beyond's validator to clear prerequisite errors.
    * The **"Dummy Feature" rule** (all required milestone levels must have a feature).
    * Subclass **Options** hierarchy vs. single feature blocks.

---

## 4. Technical Specifications & Frameworks

* **[Model Context Protocol (MCP) Specification](https://modelcontextprotocol.io/)**
  * The open protocol powering the AI client-to-server communication over `stdio`.
* **[@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)**
  * The official TypeScript SDK used to define tools and schemas (`src/server.ts`).
* **[Playwright](https://playwright.dev/)**
  * Headless browser automation engine driving Chrome to navigate ASP.NET forms, bypass Select2 styling, handle Vex modals, and submit two-phase homebrew.

---

## 5. Benchmark Creations & Test Suites

The following test suites were used to benchmark and verify automated mechanics across D&D Beyond:

1. **Ring of the Coral Tide**
   * Initial MVP test item (Rare, Attunement, Swimming Speed, Create or Destroy Water 1/day).
2. **Ring of the Coral Tide (Automated)**
   * Full mechanical engine test (+10 ft swimming speed bonus, Cold resistance badge, 1 charge resetting at Dawn, attached spell).
3. **Ring of the Storm Herald**
   * Very Rare ring testing multi-spell attachment (*Misty Step* and *Thunderwave*), +2 Initiative bonus, Lightning resistance badge, and 3 charges with daily Dawn recharge.
4. **Crown of the Titan's Vanguard**
   * Ultimate benchmark item testing all D&D Beyond mechanics simultaneously:
     * Strength +2 and twin `Ability Score Maximum` (+2) modifier to bypass DDB's 20-cap.
     * Bonus Unarmored AC (+1) without breaking Barbarian/Monk class features.
     * Walking Speed bonus (+10 ft).
     * Skill Proficiency in Athletics.
     * Advantage on Death Saving Throws.
     * Damage Resistance to Fire.
     * Sense modification (+60 ft Darkvision).
     * 5 charges with Short Rest recharge cycle.
     * 3 attached spells (*Shield*, *Misty Step*, *Fireball*) spanning Reaction, Bonus Action, and Action economies.
     * Auto-formatted dynamic snippets (`{{savedc:...}}`, `{{modifier:...}}`, `{{proficiency}}`) and tooltip BBCode tags (`[spell]`, `[condition]`, `[sense]`).
5. **Juggernaut's Stride**
   * Automated homebrew feat testing:
     * Prerequisite validation ("Strength 13 or higher").
     * Strength +1 with auto-injected `Ability Score Maximum` (+1, STR).
     * Walking Speed +10 ft.
     * Skill Proficiency in Athletics.
     * Advantage on Death Saving Throws.
     * Dynamic calculation snippet (`{{savedc:str}}`) and condition tooltip (`[condition]prone[/condition]`).
     * Automatic parent page save to compile the feat calculation cache.
