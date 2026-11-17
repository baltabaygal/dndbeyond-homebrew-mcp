import { chromium, BrowserContext } from "playwright";
import fs from "fs";
import path from "path";
import os from "os";
import dotenv from "dotenv";

dotenv.config();

export const CONFIG_DIR = path.join(os.homedir(), ".dndbeyond-homebrew");
export const SESSION_FILE = path.join(CONFIG_DIR, "session.json");

export function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function hasSavedSession(): boolean {
  return fs.existsSync(SESSION_FILE) || !!process.env.COBALT_SESSION;
}

export function getSessionCookies() {
  if (fs.existsSync(SESSION_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, "utf-8"));
      return data;
    } catch {
      return null;
    }
  }
  if (process.env.COBALT_SESSION) {
    return {
      cookies: [
        {
          name: "CobaltSession",
          value: process.env.COBALT_SESSION,
          domain: ".dndbeyond.com",
          path: "/",
          httpOnly: true,
          secure: true,
          sameSite: "Lax",
        },
      ],
    };
  }
  return null;
}

/**
 * Interactive login flow:
 * Launches a visible browser for the user to log in to D&D Beyond.
 * Captures and persists session state.
 */
export async function runInteractiveLogin() {
  ensureConfigDir();
  console.log("==================================================");
  console.log("   D&D Beyond Homebrew MCP - Interactive Login    ");
  console.log("==================================================");
  console.log("Opening browser window... Please log in to D&D Beyond.");

  const browser = await chromium
    .launch({
      headless: false,
      channel: "chrome",
    })
    .catch(() => {
      return chromium.launch({ headless: false });
    });

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("https://www.dndbeyond.com/login", { waitUntil: "domcontentloaded" });

  console.log("\nWaiting for successful login on D&D Beyond...");
  console.log("(The browser will automatically close once your session is detected)\n");

  // Poll for the CobaltSession cookie or successful user redirect
  const maxWait = 5 * 60 * 1000; // 5 minutes
  const startTime = Date.now();

  let authenticated = false;
  while (Date.now() - startTime < maxWait) {
    const cookies = await context.cookies();
    const cobalt = cookies.find((c) => c.name === "CobaltSession");
    
    if (cobalt && cobalt.value) {
      console.log("CobaltSession detected! Verifying account...");
      await context.storageState({ path: SESSION_FILE });
      authenticated = true;
      break;
    }

    // Check if the user reached homebrew or user profile
    const currentUrl = page.url();
    if (
      !currentUrl.includes("/login") &&
      !currentUrl.includes("auth.dndbeyond.com") &&
      !currentUrl.includes("accounts.google.com")
    ) {
      const hasCobalt = cookies.some((c) => c.name === "CobaltSession");
      if (hasCobalt) {
        await context.storageState({ path: SESSION_FILE });
        authenticated = true;
        break;
      }
    }

    await page.waitForTimeout(2000);
  }

  await browser.close();

  if (authenticated) {
    console.log(`\n Authentication successful!`);
    console.log(`Session saved to: ${SESSION_FILE}`);
    console.log("You can now run the MCP server or create homebrew via AI.");
  } else {
    console.error("\n Login timed out or cancelled.");
    process.exit(1);
  }
}

// Direct execution from CLI
if (process.argv[1] && process.argv[1].endsWith("auth.ts")) {
  runInteractiveLogin().catch((err) => {
    console.error("Auth error:", err);
    process.exit(1);
  });
}
