import { chromium, BrowserContext, Browser } from "playwright";
import fs from "fs";
import { SESSION_FILE } from "../auth.js";

export async function createAuthenticatedContext(): Promise<{
  browser: Browser;
  context: BrowserContext;
}> {
  const headless = process.env.HEADLESS !== "false";

  const browser = await chromium
    .launch({
      headless,
      channel: "chrome",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    })
    .catch(() => {
      return chromium.launch({
        headless,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    });

  let context: BrowserContext;

  if (fs.existsSync(SESSION_FILE)) {
    context = await browser.newContext({
      storageState: SESSION_FILE,
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    });
  } else if (process.env.COBALT_SESSION) {
    context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    });
    await context.addCookies([
      {
        name: "CobaltSession",
        value: process.env.COBALT_SESSION,
        domain: ".dndbeyond.com",
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      },
    ]);
  } else {
    throw new Error(
      "No D&D Beyond session found. Please run 'npm run auth' first or set COBALT_SESSION in your environment."
    );
  }

  return { browser, context };
}
