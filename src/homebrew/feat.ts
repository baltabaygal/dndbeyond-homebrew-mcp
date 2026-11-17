import { Page } from "playwright";
import { createAuthenticatedContext } from "./browser.js";
import { FeatInput, HomebrewCreationResult } from "../types.js";
import {
  MODIFIER_TYPE_IDS,
  STAT_IDS,
  resolveModifier,
  expandModifiersWithCapBreak,
} from "./modifier-map.js";
import { formatTooltips } from "./snippets.js";

const FEAT_SCRATCH_URL = "https://www.dndbeyond.com/homebrew/creations/create-feat/create";

async function dismissVexModals(page: Page) {
  try {
    await page.evaluate(() => {
      document.querySelectorAll(".vex, .vex-overlay").forEach((el) => el.remove());
    });
    const vexClose = page.locator(".vex-close");
    if ((await vexClose.count()) > 0) {
      await vexClose.first().click({ force: true }).catch(() => {});
    }
  } catch {}
}

export async function createFeat(feat: FeatInput): Promise<HomebrewCreationResult> {
  const { browser, context } = await createAuthenticatedContext();
  const page = await context.newPage();

  try {
    console.log(`Navigating to D&D Beyond scratch feat creator: ${FEAT_SCRATCH_URL}`);
    await page.goto(FEAT_SCRATCH_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(2000);
    await dismissVexModals(page);

    // 1. Feat Name
    console.log(`Filling Feat details for: "${feat.name}"...`);
    const nameInput = page.locator("#field-name, input[name='name']");
    await nameInput.waitFor({ state: "visible", timeout: 15000 });
    await nameInput.fill(feat.name);

    // 2. Prerequisite
    if (feat.prerequisite) {
      const prereqInput = page.locator("#field-prerequisite, input[name='prerequisite']");
      if ((await prereqInput.count()) > 0) {
        await prereqInput.fill(feat.prerequisite);
      }
    }

    // 3. Snippet
    if (feat.snippet) {
      const snippetInput = page.locator("#field-snippet, textarea[name='snippet']");
      if ((await snippetInput.count()) > 0) {
        await snippetInput.fill(feat.snippet);
      }
    }

    // 4. Description (with tooltips formatted)
    const formattedHtml = formatTooltips(feat.description)
      .split("\n\n")
      .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
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
      const desc1 = document.getElementById("field-description") as HTMLTextAreaElement | null;
      if (desc1) desc1.value = html;
      const desc2 = document.getElementById("field-description-wysiwyg") as HTMLTextAreaElement | null;
      if (desc2) desc2.value = html;
    }, formattedHtml);

    // 5. Submit Form to create the Feat Shell
    console.log("Submitting form via CREATE FEAT button...");
    const submitBtn = page.locator('button[type="submit"]:has-text("CREATE FEAT"), input[type="submit"][value*="CREATE"]');
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }),
      submitBtn.first().click({ force: true }),
    ]);

    await page.waitForTimeout(3000);
    const finalUrl = page.url();
    console.log(`Feat Shell Created: ${finalUrl}`);

    const idMatch = finalUrl.match(/feats?\/(\d+)/i) || finalUrl.match(/creations\/(\d+)/i);
    const featId = idMatch ? idMatch[1] : undefined;

    let addedModifiersCount = 0;

    // 6. Attach Modifiers if requested
    if (featId && feat.modifiers && feat.modifiers.length > 0) {
      const targetModifiers = expandModifiersWithCapBreak(feat.modifiers);
      console.log(`Attaching ${targetModifiers.length} mechanical modifier(s) to Feat...`);

      for (const mod of targetModifiers) {
        try {
          const modLink = await page.evaluate(() => {
            const link = document.querySelector('a[href*="/modifier/create/"]') as HTMLAnchorElement | null;
            return link ? link.href : null;
          });

          if (!modLink) {
            console.warn("Could not find Add Modifier link on feat edit page.");
            break;
          }

          console.log(`Opening modifier form: ${modLink}`);
          await page.goto(modLink, { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(1500);
          await dismissVexModals(page);

          const { typeId, subTypeId, subTypeName } = resolveModifier(mod.type, mod.subType);

          await page.evaluate(
            ({ typeId, subTypeId, subTypeName, fixedVal, diceCount, diceVal, statId }) => {
              const typeSel = document.getElementById("field-spell-modifier-type") as HTMLSelectElement;
              if (typeSel) typeSel.value = typeId;

              const subSel = document.getElementById("field-spell-modifier-sub-type") as HTMLSelectElement;
              if (subSel && subTypeId) {
                let opt = Array.from(subSel.options).find((o) => o.value === subTypeId);
                if (!opt) {
                  opt = document.createElement("option");
                  opt.value = subTypeId;
                  opt.text = subTypeName || subTypeId;
                  subSel.appendChild(opt);
                }
                subSel.value = subTypeId;
              }

              if (fixedVal !== undefined) {
                const fixInput = document.getElementById("field-fixed-value") as HTMLInputElement;
                if (fixInput) fixInput.value = String(fixedVal);
              }

              if (diceCount) {
                const countInput = document.getElementById("field-dice-count") as HTMLInputElement;
                if (countInput) countInput.value = String(diceCount);
              }
              if (diceVal) {
                const valSel = document.getElementById("field-dice-value") as HTMLSelectElement;
                if (valSel) valSel.value = String(diceVal);
              }

              if (statId) {
                const statSel = document.getElementById("field-rpg-stat") as HTMLSelectElement;
                if (statSel) statSel.value = statId;
              }
            },
            {
              typeId,
              subTypeId,
              subTypeName: subTypeName || mod.subType,
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
          console.log(`Attached feat modifier: ${mod.type} - ${mod.subType}`);
          await page.waitForTimeout(1000);
        } catch (e: any) {
          console.error(`Failed to attach feat modifier ${mod.type} - ${mod.subType}:`, e.message);
        }
      }
    }

    // 7. Final Parent Page Save (Compiles the modifier bundle into DDB's calculation cache)
    if (featId && feat.modifiers && feat.modifiers.length > 0) {
      console.log(`Committing final Save Changes on parent feat page to compile calculation cache...`);
      try {
        await page.goto(finalUrl, { waitUntil: "networkidle" });
        await page.waitForTimeout(2000);
        await dismissVexModals(page);
        const saveChangesBtn = page.locator("button:has-text('Save Changes'), input[value='Save Changes'], .btn-save");
        if ((await saveChangesBtn.count()) > 0) {
          await saveChangesBtn.first().click({ force: true });
          await page.waitForNavigation({ waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
          await page.waitForTimeout(2000);
          console.log(`Parent feat calculation cache successfully compiled and committed!`);
        }
      } catch (err: any) {
        console.warn(`Note: Final parent feat page save warning:`, err.message);
      }
    }

    return {
      success: true,
      name: feat.name,
      url: finalUrl,
      id: featId,
      details: {
        prerequisite: feat.prerequisite,
        addedModifiersCount,
      },
    };
  } catch (error: any) {
    console.error("Failed to create feat:", error);
    return {
      success: false,
      name: feat.name,
      error: error.message || String(error),
    };
  } finally {
    await browser.close();
  }
}
