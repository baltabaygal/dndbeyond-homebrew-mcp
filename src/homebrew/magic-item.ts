import { Page } from "playwright";
import { createAuthenticatedContext } from "./browser.js";
import {
  MagicItemInput,
  HomebrewCreationResult,
  Rarity,
  MagicItemType,
  ModifierInput,
  AttachedSpellInput,
} from "../types.js";
import {
  MODIFIER_TYPE_IDS,
  RESET_CONDITION_IDS,
  STAT_IDS,
  resolveModifier,
  expandModifiersWithCapBreak,
} from "./modifier-map.js";
import { formatTooltips } from "./snippets.js";

const RARITY_MAP: Record<Rarity, string> = {
  Common: "1",
  Uncommon: "2",
  Rare: "3",
  "Very Rare": "4",
  Legendary: "5",
  Artifact: "7",
};

const TYPE_MAP: Record<MagicItemType, { baseType: string; subType: string }> = {
  Armor: { baseType: "701257905", subType: "" },
  Weapon: { baseType: "1782728300", subType: "" },
  Ring: { baseType: "", subType: "4" },
  Rod: { baseType: "", subType: "5" },
  Scroll: { baseType: "", subType: "6" },
  Staff: { baseType: "", subType: "7" },
  Wand: { baseType: "", subType: "8" },
  Potion: { baseType: "", subType: "3" },
  "Wondrous Item": { baseType: "", subType: "10" },
};

async function dismissVexModals(page: Page) {
  await page.evaluate(() => {
    const closeBtn = document.querySelector(
      ".vex-close, .vex-dialog-button.close, .vex .close"
    ) as HTMLElement | null;
    if (closeBtn) closeBtn.click();
    document.querySelectorAll(".vex, .vex-overlay").forEach((el) => el.remove());
  });
}

export async function createMagicItem(
  item: MagicItemInput
): Promise<HomebrewCreationResult> {
  const { browser, context } = await createAuthenticatedContext();
  const page = await context.newPage();

  try {
    if (item.template) {
      console.log(`Cloning official template: "${item.template}"...`);
      await page.goto("https://www.dndbeyond.com/homebrew/creations/create-magic-item", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await page.waitForTimeout(2000);
      await dismissVexModals(page);

      const matched = await page.evaluate((tmpl) => {
        const sel = document.getElementById("field-magic-item") as HTMLSelectElement | null;
        if (!sel) return false;
        const opt = Array.from(sel.options).find((o) =>
          o.text.toLowerCase().includes(tmpl.toLowerCase())
        );
        if (opt) {
          sel.value = opt.value;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        }
        return false;
      }, item.template);

      if (matched) {
        console.log(`Template matched! Creating cloned item...`);
        const createBtn = page.locator('form[action*="create-magic-item"] button[type="submit"]');
        await Promise.all([
          page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }),
          createBtn.click({ force: true }),
        ]);
        await page.waitForTimeout(2000);
      } else {
        console.warn(`Template "${item.template}" not found. Falling back to scratch creation.`);
        await page.goto("https://www.dndbeyond.com/homebrew/creations/create-magic-item/create", {
          waitUntil: "domcontentloaded",
        });
      }
    } else {
      console.log(`Navigating to D&D Beyond scratch magic item creator...`);
      await page.goto("https://www.dndbeyond.com/homebrew/creations/create-magic-item/create", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
    }

    if (page.url().includes("/login")) {
      throw new Error("Authentication expired or invalid. Please re-run 'npm run auth'.");
    }

    await page.waitForSelector("#field-name", { timeout: 15000 });
    await dismissVexModals(page);
    await page.waitForTimeout(500);

    console.log(`Filling details for: "${item.name}"...`);

    // 1. Name
    await page.fill("#field-name", item.name);

    // 2. Version
    const versionField = page.locator("#field-version");
    if ((await versionField.count()) > 0) {
      await versionField.fill("1.0");
    }

    // 3. Rarity & Type
    console.log(`Setting Rarity (${item.rarity}) and Type (${item.itemType})...`);
    const rarityVal = RARITY_MAP[item.rarity] || "3";
    const mapping = TYPE_MAP[item.itemType] || { baseType: "", subType: "10" };

    await page.evaluate(
      ({ rarity, baseType, subType }) => {
        const jq = (window as any).jQuery || (window as any).$;

        const rarityEl = document.getElementById("field-rarity") as HTMLSelectElement | null;
        if (rarityEl) {
          rarityEl.value = rarity;
          rarityEl.dispatchEvent(new Event("change", { bubbles: true }));
          if (jq) jq(rarityEl).val(rarity).trigger("change");
        }

        if (baseType) {
          const baseEl = document.getElementById("field-item-base-type") as HTMLSelectElement | null;
          if (baseEl) {
            baseEl.value = baseType;
            baseEl.dispatchEvent(new Event("change", { bubbles: true }));
            if (jq) jq(baseEl).val(baseType).trigger("change");
          }
        }

        if (subType) {
          const typeEl = document.getElementById("field-type") as HTMLSelectElement | null;
          if (typeEl) {
            typeEl.value = subType;
            typeEl.dispatchEvent(new Event("change", { bubbles: true }));
            if (jq) jq(typeEl).val(subType).trigger("change");
          }
        }
      },
      { rarity: rarityVal, baseType: mapping.baseType, subType: mapping.subType }
    );

    // 4. Attunement
    console.log(`Setting Attunement (${item.requiresAttunement})...`);
    await page.evaluate((requiresAttunement) => {
      const cb = document.getElementById("field-requires-attunement") as HTMLInputElement | null;
      if (cb) {
        cb.checked = requiresAttunement;
        cb.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }, item.requiresAttunement);

    if (item.requiresAttunement && item.attunementDescription) {
      const attuneDesc = page.locator("#field-attunement-description");
      if ((await attuneDesc.count()) > 0) {
        await attuneDesc.fill(item.attunementDescription);
      }
    }

    // 5. Charges & Reset Conditions
    if (item.charges) {
      console.log(`Setting Charges (${item.charges.count}, Reset: ${item.charges.resetCondition})...`);
      const resetId = RESET_CONDITION_IDS[item.charges.resetCondition] || "2";

      await page.evaluate(
        ({ count, resetId, resetDesc }) => {
          const chBox = document.getElementById("field-has-charges") as HTMLInputElement | null;
          if (chBox) {
            chBox.checked = true;
            chBox.dispatchEvent(new Event("change", { bubbles: true }));
          }
          const numInput = document.getElementById("field-number-of-charges") as HTMLInputElement | null;
          if (numInput) numInput.value = String(count);

          const resetSel = document.getElementById("field-charge-reset-condition") as HTMLSelectElement | null;
          if (resetSel) {
            resetSel.value = resetId;
            resetSel.dispatchEvent(new Event("change", { bubbles: true }));
          }

          if (resetDesc) {
            const descArea = document.getElementById("field-charge-reset-description") as HTMLTextAreaElement | null;
            if (descArea) descArea.value = resetDesc;
          }
        },
        {
          count: item.charges.count,
          resetId,
          resetDesc: item.charges.resetDescription || `Regains all charges after a ${item.charges.resetCondition.toLowerCase()}.`,
        }
      );
    }

    // 6. Snippet & Notes
    if (item.snippet) {
      const snippetField = page.locator("#field-snippet, textarea[name='snippet']");
      if ((await snippetField.count()) > 0) {
        await snippetField.fill(item.snippet);
      }
    }
    if (item.notes) {
      const notesField = page.locator("#field-notes, textarea[name='notes']");
      if ((await notesField.count()) > 0) {
        await notesField.fill(item.notes);
      }
    }

    // 7. Description
    console.log(`Setting description content...`);
    const spellNames = item.spells?.map((s) => s.spellName) || [];
    const formattedDesc = formatTooltips(item.description, spellNames);
    const formattedHtml = formattedDesc
      .split("\n\n")
      .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
      .join("");

    await page.evaluate((html) => {
      const anyWin = window as any;
      if (anyWin.tinymce) {
        const editors = anyWin.tinymce.editors || [];
        for (const ed of editors) {
          try {
            ed.setContent(html);
          } catch {}
        }
      }
      const desc1 = document.getElementById("field-item-description") as HTMLTextAreaElement | null;
      if (desc1) desc1.value = html;
      const desc2 = document.getElementById("field-item-description-wysiwyg") as HTMLTextAreaElement | null;
      if (desc2) desc2.value = html;
    }, formattedHtml);

    // 8. Submit Form to create the Item Shell
    console.log(`Submitting form via CREATE MAGIC ITEM button...`);
    const submitBtn = page.locator('button[type="submit"]:has-text("CREATE MAGIC ITEM")');

    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }),
      submitBtn.click({ force: true }),
    ]);

    await page.waitForTimeout(3000);
    const finalUrl = page.url();
    console.log(`Item Shell Created: ${finalUrl}`);

    const idMatch = finalUrl.match(/magic-items?\/(\d+)/i) || finalUrl.match(/creations\/(\d+)/i);
    const itemId = idMatch ? idMatch[1] : undefined;

    // 8b. Configure Charges & Reset Conditions on the Edit page (where DDB exposes them)
    if (itemId && item.charges) {
      console.log(`Configuring Charges on Edit page (${item.charges.count}, Reset: ${item.charges.resetCondition})...`);
      const resetId = RESET_CONDITION_IDS[item.charges.resetCondition] || "2";
      const resetDescText =
        item.charges.resetDescription ||
        `Regains all ${item.charges.count} charges daily at ${item.charges.resetCondition.toLowerCase()}.`;

      await page.evaluate(
        ({ count, resetId, resetDesc }) => {
          const chBox = document.getElementById("field-has-charges") as HTMLInputElement | null;
          if (chBox && !chBox.checked) {
            chBox.checked = true;
            chBox.dispatchEvent(new Event("change", { bubbles: true }));
          }

          const numInput = document.getElementById("field-number-of-charges") as HTMLInputElement | null;
          if (numInput) {
            numInput.value = String(count);
            numInput.dispatchEvent(new Event("input", { bubbles: true }));
          }

          const resetSel = document.getElementById("field-charge-reset-condition") as HTMLSelectElement | null;
          if (resetSel) {
            resetSel.value = resetId;
            resetSel.dispatchEvent(new Event("change", { bubbles: true }));
          }

          const descArea = document.getElementById("field-charge-reset-description") as HTMLTextAreaElement | null;
          if (descArea) descArea.value = resetDesc;
        },
        { count: item.charges.count, resetId, resetDesc: resetDescText }
      );

      await page.waitForTimeout(500);

      console.log(`Saving charge configuration...`);
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {}),
        page.evaluate(() => {
          const form = document.getElementById("field-name")?.closest("form");
          const btn = form?.querySelector('button[type="submit"]') as HTMLButtonElement | null;
          if (btn) btn.click();
        }),
      ]);
      await page.waitForTimeout(1500);
    }

    let addedModifiersCount = 0;
    let addedSpellsCount = 0;

    // 9. Attach Modifiers if requested
    if (itemId && item.modifiers && item.modifiers.length > 0) {
      // Auto-expand ability score bonuses to also raise Ability Score Maximum (Rule #2: Break 20 cap)
      const targetModifiers = expandModifiersWithCapBreak(item.modifiers);
      console.log(`Attaching ${targetModifiers.length} mechanical modifier(s)...`);
      for (const mod of targetModifiers) {
        try {
          const modLink = await page.evaluate(() => {
            const link = document.querySelector('a[href*="/modifier/create/"]') as HTMLAnchorElement | null;
            return link ? link.href : null;
          });

          if (!modLink) {
            console.warn("Could not find Add Modifier link on edit page.");
            break;
          }

          console.log(`Opening modifier form: ${modLink}`);
          await page.goto(modLink, { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(1500);
          await dismissVexModals(page);

          const { typeId, subTypeId } = resolveModifier(mod.type, mod.subType);

          await page.evaluate(
            ({ typeId, subTypeId, subTypeName, fixedVal, diceCount, diceVal, statId }) => {
              // Set modifier type
              const typeSel = document.getElementById("field-spell-modifier-type") as HTMLSelectElement;
              if (typeSel) typeSel.value = typeId;

              // Set modifier subtype
              const subSel = document.getElementById("field-spell-modifier-sub-type") as HTMLSelectElement;
              if (subSel && subTypeId) {
                let opt = Array.from(subSel.options).find((o) => o.value === subTypeId);
                if (!opt) {
                  opt = document.createElement("option");
                  opt.value = subTypeId;
                  opt.text = subTypeName;
                  subSel.appendChild(opt);
                }
                subSel.value = subTypeId;
              }

              // Set fixed value
              if (fixedVal !== undefined) {
                const fixInput = document.getElementById("field-fixed-value") as HTMLInputElement;
                if (fixInput) fixInput.value = String(fixedVal);
              }

              // Set dice
              if (diceCount) {
                const countInput = document.getElementById("field-dice-count") as HTMLInputElement;
                if (countInput) countInput.value = String(diceCount);
              }
              if (diceVal) {
                const valSel = document.getElementById("field-dice-value") as HTMLSelectElement;
                if (valSel) valSel.value = String(diceVal);
              }

              // Set stat
              if (statId) {
                const statSel = document.getElementById("field-rpg-stat") as HTMLSelectElement;
                if (statSel) statSel.value = statId;
              }
            },
            {
              typeId,
              subTypeId,
              subTypeName: mod.subType,
              fixedVal: mod.fixedValue,
              diceCount: mod.diceCount,
              diceVal: mod.diceValue,
              statId: mod.stat ? STAT_IDS[mod.stat] : undefined,
            }
          );

          await page.waitForTimeout(500);

          const saveModBtn = page.locator('button[type="submit"]:has-text("Save"), input[type="submit"][value*="Save"]');
          await Promise.all([
            page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20000 }),
            saveModBtn.click({ force: true }),
          ]);

          addedModifiersCount++;
          console.log(`Attached modifier: ${mod.type} - ${mod.subType}`);
          await page.waitForTimeout(1000);
        } catch (e: any) {
          console.error(`Failed to attach modifier ${mod.type} - ${mod.subType}:`, e.message);
        }
      }
    }

    // 10. Attach Spells if requested
    if (itemId && item.spells && item.spells.length > 0) {
      console.log(`Attaching ${item.spells.length} spell(s)...`);
      const spellCreateUrl = `https://www.dndbeyond.com/magic-items/spell/create/${itemId}`;

      for (const spell of item.spells) {
        try {
          console.log(`Opening spell attach form: ${spellCreateUrl}`);
          await page.goto(spellCreateUrl, { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(1500);
          await dismissVexModals(page);

          const matchedValue = await page.evaluate((targetName) => {
            const spellSel = document.getElementById("field-item-spell") as HTMLSelectElement;
            if (!spellSel) return null;
            const opt = Array.from(spellSel.options).find((o) =>
              o.text.toLowerCase().includes(targetName.toLowerCase())
            );
            return opt ? opt.value : null;
          }, spell.spellName);

          if (!matchedValue) {
            console.warn(`Spell "${spell.spellName}" not found in D&D Beyond database.`);
            continue;
          }

          await page.evaluate(
            ({ spellVal, charges, saveDc, castAtLevel, restriction }) => {
              const spellSel = document.getElementById("field-item-spell") as HTMLSelectElement;
              if (spellSel) spellSel.value = spellVal;

              if (charges) {
                const minCh = document.getElementById("field-min-charges") as HTMLInputElement;
                if (minCh) minCh.value = String(charges);
                const maxCh = document.getElementById("field-max-charges") as HTMLInputElement;
                if (maxCh) maxCh.value = String(charges);
              }

              if (saveDc) {
                const dcInput = document.getElementById("field-save-dc") as HTMLInputElement;
                if (dcInput) dcInput.value = String(saveDc);
              }

              if (castAtLevel) {
                const lvlSel = document.getElementById("field-cast-at-level") as HTMLSelectElement;
                if (lvlSel) lvlSel.value = String(castAtLevel);
              }

              if (restriction) {
                const rest = document.getElementById("field-restriction") as HTMLTextAreaElement;
                if (rest) rest.value = restriction;
              }
            },
            {
              spellVal: matchedValue,
              charges: spell.charges,
              saveDc: spell.saveDc,
              castAtLevel: spell.castAtLevel,
              restriction: spell.restriction,
            }
          );

          await page.waitForTimeout(500);

          const saveSpellBtn = page.locator('button[type="submit"]:has-text("Save"), input[type="submit"][value*="Save"]');
          await Promise.all([
            page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20000 }),
            saveSpellBtn.click({ force: true }),
          ]);

          addedSpellsCount++;
          console.log(`Attached spell: "${spell.spellName}"`);
          await page.waitForTimeout(1000);
        } catch (e: any) {
          console.error(`Failed to attach spell ${spell.spellName}:`, e.message);
        }
      }
    }

    // 11. Final Parent Page Save (Compiles the modifier/spell bundle into DDB's calculation cache)
    if (itemId && ((item.modifiers && item.modifiers.length > 0) || (item.spells && item.spells.length > 0))) {
      console.log(`Committing final Save Changes on parent item page to compile calculation cache...`);
      try {
        await page.goto(finalUrl, { waitUntil: "networkidle" });
        await page.waitForTimeout(2000);
        await dismissVexModals(page);
        const saveChangesBtn = page.locator("button:has-text('Save Changes'), input[value='Save Changes'], .btn-save");
        if ((await saveChangesBtn.count()) > 0) {
          await saveChangesBtn.first().click({ force: true });
          await page.waitForNavigation({ waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
          await page.waitForTimeout(2000);
          console.log(`Parent item calculation cache successfully compiled and committed!`);
        }
      } catch (err: any) {
        console.warn(`Note: Final parent page save warning:`, err.message);
      }
    }

    return {
      success: true,
      name: item.name,
      url: finalUrl,
      id: itemId,
      details: {
        rarity: item.rarity,
        itemType: item.itemType,
        requiresAttunement: item.requiresAttunement,
        charges: item.charges,
        addedModifiersCount,
        addedSpellsCount,
      },
    };
  } catch (error: any) {
    console.error("Failed to create magic item:", error);
    return {
      success: false,
      name: item.name,
      error: error.message || String(error),
    };
  } finally {
    await browser.close();
  }
}
