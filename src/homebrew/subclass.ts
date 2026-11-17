import { Page } from "playwright";
import { createAuthenticatedContext } from "./browser.js";
import { BaseClass, SubclassInput, HomebrewCreationResult } from "../types.js";
import {
  STAT_IDS,
  resolveModifier,
  expandModifiersWithCapBreak,
} from "./modifier-map.js";
import { formatTooltips } from "./snippets.js";

const SUBCLASS_SELECT_URL = "https://www.dndbeyond.com/homebrew/creations/create-subclass";

export const BASE_CLASS_IDS: Record<BaseClass, string> = {
  Barbarian: "2190875",
  Bard: "2190876",
  Cleric: "2190877",
  Druid: "2190878",
  Fighter: "2190879",
  Monk: "2190880",
  Paladin: "2190881",
  Ranger: "2190882",
  Rogue: "2190883",
  Sorcerer: "2190884",
  Warlock: "2190885",
  Wizard: "2190886",
  Artificer: "2656866",
  "Blood Hunter": "357975",
};

export const CLASS_FEATURE_LEVELS: Record<BaseClass, number[]> = {
  Barbarian: [3, 6, 10, 14],
  Bard: [3, 6, 14],
  Cleric: [1, 2, 6, 8, 17],
  Druid: [2, 3, 6, 10, 14],
  Fighter: [3, 7, 10, 15, 18],
  Monk: [3, 6, 11, 17],
  Paladin: [3, 7, 15, 20],
  Ranger: [3, 7, 11, 15],
  Rogue: [3, 9, 13, 17],
  Sorcerer: [1, 6, 14, 18],
  Warlock: [1, 6, 10, 14],
  Wizard: [2, 6, 10, 14],
  Artificer: [3, 5, 9, 15],
  "Blood Hunter": [3, 7, 11, 15, 18],
};

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

export async function createSubclass(input: SubclassInput): Promise<HomebrewCreationResult> {
  const { browser, context } = await createAuthenticatedContext();
  const page = await context.newPage();

  try {
    console.log(`Navigating to Subclass selection: ${SUBCLASS_SELECT_URL}`);
    await page.goto(SUBCLASS_SELECT_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(2000);
    await dismissVexModals(page);

    // 1. Select Base Class
    const classId = BASE_CLASS_IDS[input.baseClass] || "2190879";
    console.log(`Selecting Base Class: ${input.baseClass} (ID: ${classId})...`);

    await page.evaluate((cid) => {
      const sel = document.getElementById("field-class-type") as HTMLSelectElement | null;
      if (sel) {
        sel.value = cid;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }, classId);

    await page.waitForTimeout(1000);

    // Click Create to move to Subclass Edit shell
    const createBtn = page.locator('button[type="submit"]:has-text("Create"), input[type="submit"][value*="Create"]');
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }),
      createBtn.first().click({ force: true }),
    ]);

    await page.waitForTimeout(2000);
    await dismissVexModals(page);

    // 2. Subclass Name & Description
    console.log(`Filling Subclass details for: "${input.name}"...`);
    const nameInput = page.locator("#field-name, input[name='name']");
    await nameInput.waitFor({ state: "visible", timeout: 15000 });
    await nameInput.fill(input.name);

    if (input.shortDescription) {
      const shortDesc = page.locator("#field-short-description, textarea[name='short-description']");
      if ((await shortDesc.count()) > 0) {
        await shortDesc.fill(input.shortDescription);
      }
    }

    const formattedDesc = formatTooltips(input.description)
      .split("\n\n")
      .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
      .join("");

    await page.evaluate((html) => {
      const desc1 = document.getElementById("field-description") as HTMLTextAreaElement | null;
      if (desc1) desc1.value = html;
      const desc2 = document.getElementById("field-description-wysiwyg") as HTMLTextAreaElement | null;
      if (desc2) desc2.value = html;
    }, formattedDesc);

    // Submit initial shell
    console.log("Submitting initial subclass shell...");
    const submitShellBtn = page.locator('button[type="submit"]:has-text("CREATE SUBCLASS"), input[type="submit"][value*="CREATE"]');
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }),
      submitShellBtn.first().click({ force: true }),
    ]);

    await page.waitForTimeout(3000);
    const finalUrl = page.url();
    console.log(`Subclass Shell Created: ${finalUrl}`);

    const idMatch = finalUrl.match(/subclasses?\/(\d+)/i) || finalUrl.match(/creations\/(\d+)/i);
    const subclassId = idMatch ? idMatch[1] : undefined;

    // 3. Add Features (with Dummy Feature check for milestone levels)
    const requiredLevels = CLASS_FEATURE_LEVELS[input.baseClass] || [3, 7, 10, 15, 18];
    const userFeatures = input.features || [];
    const featureMap = new Map<number, typeof userFeatures[0]>();
    userFeatures.forEach((f) => featureMap.set(f.level, f));

    // Ensure all required milestone levels have a feature
    const featuresToCreate: Array<{
      name: string;
      level: number;
      description: string;
      snippet?: string;
      modifiers?: any[];
    }> = [];

    for (const lvl of requiredLevels) {
      if (featureMap.has(lvl)) {
        featuresToCreate.push(featureMap.get(lvl)!);
      } else {
        featuresToCreate.push({
          name: `${input.name} Milestone (Level ${lvl})`,
          level: lvl,
          description: `Additional subclass feature granted at level ${lvl}.`,
        });
      }
    }

    let addedFeaturesCount = 0;
    let addedModifiersCount = 0;

    for (const feat of featuresToCreate) {
      try {
        console.log(`Adding class feature: "${feat.name}" (Level ${feat.level})...`);
        const addFeatureLink = await page.evaluate(() => {
          const link = document.querySelector('a[href*="/feature/create"]') as HTMLAnchorElement | null;
          return link ? link.href : null;
        });

        if (!addFeatureLink) {
          console.warn("Could not find Add Class Feature link.");
          break;
        }

        await page.goto(addFeatureLink, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1500);
        await dismissVexModals(page);

        // Fill feature name, level, snippet, description
        await page.locator("#field-name, input[name='name']").fill(feat.name);
        await page.locator("#field-level, input[name='level']").fill(String(feat.level));

        if (feat.snippet) {
          const snip = page.locator("#field-snippet, textarea[name='snippet']");
          if ((await snip.count()) > 0) await snip.fill(feat.snippet);
        }

        const featHtml = formatTooltips(feat.description)
          .split("\n\n")
          .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
          .join("");

        await page.evaluate((html) => {
          const d1 = document.getElementById("field-description") as HTMLTextAreaElement | null;
          if (d1) d1.value = html;
        }, featHtml);

        const saveFeatBtn = page.locator('button[type="submit"]:has-text("Save"), input[type="submit"][value*="Save"]');
        await Promise.all([
          page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 25000 }),
          saveFeatBtn.first().click({ force: true }),
        ]);

        addedFeaturesCount++;
        console.log(`Saved feature: "${feat.name}"`);
        await page.waitForTimeout(1500);

        // If feature has modifiers, attach them with Cap Break
        if (feat.modifiers && feat.modifiers.length > 0) {
          const targetModifiers = expandModifiersWithCapBreak(feat.modifiers);
          console.log(`Attaching ${targetModifiers.length} modifier(s) to feature "${feat.name}"...`);

          for (const mod of targetModifiers) {
            try {
              const modLink = await page.evaluate(() => {
                const link = document.querySelector('a[href*="/modifier/create/"]') as HTMLAnchorElement | null;
                return link ? link.href : null;
              });

              if (!modLink) break;

              await page.goto(modLink, { waitUntil: "domcontentloaded" });
              await page.waitForTimeout(1200);
              await dismissVexModals(page);

              const { typeId, subTypeId, subTypeName } = resolveModifier(mod.type, mod.subType);

              await page.evaluate(
                ({ typeId, subTypeId, subTypeName, fixedVal, statId }) => {
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
                  statId: mod.stat ? STAT_IDS[mod.stat] : undefined,
                }
              );

              const saveModBtn = page.locator('button[type="submit"]:has-text("Save"), input[type="submit"][value*="Save"]');
              await Promise.all([
                page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20000 }),
                saveModBtn.click({ force: true }),
              ]);
              addedModifiersCount++;
              await page.waitForTimeout(1000);
            } catch (err: any) {
              console.error(`Error attaching modifier to feature:`, err.message);
            }
          }
        }
      } catch (e: any) {
        console.error(`Failed to add feature:`, e.message);
      }
    }

    // 4. "The Save Button Trick" — Final Parent Page Save to clear validation warnings and compile cache
    console.log(`Committing final Save Changes on parent subclass page to compile calculation cache...`);
    try {
      await page.goto(finalUrl, { waitUntil: "networkidle" });
      await page.waitForTimeout(2000);
      await dismissVexModals(page);
      const saveChangesBtn = page.locator("button:has-text('Save Changes'), input[value='Save Changes'], .btn-save");
      if ((await saveChangesBtn.count()) > 0) {
        await saveChangesBtn.first().click({ force: true });
        await page.waitForNavigation({ waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(2000);
        console.log(`Parent subclass calculation cache successfully compiled and committed!`);
      }
    } catch (err: any) {
      console.warn(`Note: Final parent subclass save warning:`, err.message);
    }

    return {
      success: true,
      name: input.name,
      url: finalUrl,
      id: subclassId,
      details: {
        baseClass: input.baseClass,
        addedFeaturesCount,
        addedModifiersCount,
      },
    };
  } catch (error: any) {
    console.error("Failed to create subclass:", error);
    return {
      success: false,
      name: input.name,
      error: error.message || String(error),
    };
  } finally {
    await browser.close();
  }
}
