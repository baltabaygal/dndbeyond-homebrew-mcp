import { Page } from "playwright";
import { createAuthenticatedContext } from "./browser.js";
import { SpellInput, HomebrewCreationResult } from "../types.js";
import { formatTooltips } from "./snippets.js";

async function dismissVexModals(page: Page) {
  await page.evaluate(() => {
    const closeBtn = document.querySelector(
      ".vex-close, .vex-dialog-button.close, .vex .close"
    ) as HTMLElement | null;
    if (closeBtn) closeBtn.click();
    document.querySelectorAll(".vex, .vex-overlay").forEach((el) => el.remove());
  });
}

const SCHOOL_MAP: Record<string, string> = {
  Abjuration: "1",
  Conjuration: "2",
  Divination: "3",
  Enchantment: "4",
  Evocation: "5",
  Illusion: "6",
  Necromancy: "7",
  Transmutation: "8",
};

const ACTIVATION_MAP: Record<string, string> = {
  Action: "1",
  "Bonus Action": "3",
  Reaction: "4",
  Minute: "6",
  Hour: "7",
};

export async function createSpell(spell: SpellInput): Promise<HomebrewCreationResult> {
  const { browser, context } = await createAuthenticatedContext();
  const page = await context.newPage();

  try {
    console.log(`Navigating to D&D Beyond scratch spell creator...`);
    await page.goto("https://www.dndbeyond.com/homebrew/creations/create-spell/create", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    if (page.url().includes("/login")) {
      throw new Error("Authentication expired or invalid. Please re-run 'npm run auth'.");
    }

    await page.waitForSelector("#field-Name", { timeout: 15000 });
    await dismissVexModals(page);
    await page.waitForTimeout(500);

    console.log(`Filling details for spell: "${spell.name}"...`);

    // 1. Name
    await page.fill("#field-Name", spell.name);

    // 2. Version
    const versionField = page.locator("#field-version");
    if ((await versionField.count()) > 0) {
      await versionField.fill("1.0");
    }

    // 3. Spell Level & School
    const schoolVal = SCHOOL_MAP[spell.school] || "5";
    const activationVal = spell.activation ? ACTIVATION_MAP[spell.activation] || "1" : "1";

    await page.evaluate(
      ({ level, schoolVal, activationVal, castingNum }) => {
        const lvlSel = document.getElementById("field-spell-level") as HTMLSelectElement | null;
        if (lvlSel) lvlSel.value = String(level);

        const schoolSel = document.getElementById("field-spell-school") as HTMLSelectElement | null;
        if (schoolSel) schoolSel.value = schoolVal;

        const actSel = document.getElementById("field-spell-activation") as HTMLSelectElement | null;
        if (actSel) actSel.value = activationVal;

        const castInput = document.getElementById("field-spell-casting-time") as HTMLInputElement | null;
        if (castInput) castInput.value = String(castingNum || 1);
      },
      {
        level: spell.level,
        schoolVal,
        activationVal,
        castingNum: spell.castingTimeNumber || 1,
      }
    );

    // 4. Reaction condition (if reaction)
    if (spell.reactionCondition) {
      const reactInput = page.locator("#field-spell-casting-time-description");
      if ((await reactInput.count()) > 0) {
        await reactInput.fill(spell.reactionCondition);
      }
    }

    // 5. Components
    await page.evaluate((comp) => {
      const vBox = document.getElementById("field-verbal-field") as HTMLInputElement | null;
      if (vBox) vBox.checked = comp.verbal;

      const sBox = document.getElementById("field-somatic-field") as HTMLInputElement | null;
      if (sBox) sBox.checked = comp.somatic;

      const mBox = document.getElementById("field-material-field") as HTMLInputElement | null;
      if (mBox) mBox.checked = comp.material;

      if (comp.material && comp.materialsDescription) {
        const matInput = document.getElementById("field-spell-components") as HTMLInputElement | null;
        if (matInput) matInput.value = comp.materialsDescription;
      }
    }, spell.components);

    // 6. Range / Distance
    if (spell.rangeDistance) {
      const rangeInput = page.locator("#field-spell-range");
      if ((await rangeInput.count()) > 0) {
        await rangeInput.fill(spell.rangeDistance);
      }
    }

    // 7. Duration
    if (spell.durationText) {
      const durInput = page.locator("#field-spell-duration, #field-spell-duration-interval");
      if ((await durInput.count()) > 0) {
        await durInput.first().fill(spell.durationText);
      }
    }

    // 8. Description & At Higher Levels
    console.log(`Setting description content...`);
    const formattedDesc = formatTooltips(spell.description);
    const formattedHtml = formattedDesc
      .split("\n\n")
      .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
      .join("");

    await page.evaluate(
      ({ html, higherLevels }) => {
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

        if (higherLevels) {
          const hlArea = document.getElementById("field-higher-level-description") as HTMLTextAreaElement | null;
          if (hlArea) hlArea.value = higherLevels;
        }
      },
      { html: formattedHtml, higherLevels: spell.atHigherLevels }
    );

    // 9. Submit Form
    console.log(`Submitting spell form via CREATE SPELL button...`);
    const submitBtn = page.locator('button[type="submit"]:has-text("CREATE SPELL")');

    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }),
      submitBtn.click({ force: true }),
    ]);

    await page.waitForTimeout(3000);
    const finalUrl = page.url();
    console.log(`Spell Created. Resulting URL: ${finalUrl}`);

    const idMatch = finalUrl.match(/spells?\/(\d+)/i) || finalUrl.match(/creations\/(\d+)/i);
    const id = idMatch ? idMatch[1] : undefined;

    return {
      success: true,
      name: spell.name,
      url: finalUrl,
      id,
      details: {
        level: spell.level,
        school: spell.school,
        activation: spell.activation,
      },
    };
  } catch (error: any) {
    console.error("Failed to create spell:", error);
    return {
      success: false,
      name: spell.name,
      error: error.message || String(error),
    };
  } finally {
    await browser.close();
  }
}
