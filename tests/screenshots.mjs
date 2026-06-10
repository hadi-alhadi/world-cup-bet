// Ad-hoc visual capture of the running app (not part of the test suite).
import { chromium } from "@playwright/test";
import fs from "node:fs";

const OUT = "screenshots";
fs.mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:3000";

async function login(page, email) {
  await page.goto(`${BASE}/login`);
  await page.getByTestId("dev-email").fill(email);
  await page.getByTestId("dev-signin").click();
  await page.waitForURL("**/games", { timeout: 15000 });
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// Login page (logged out)
await page.goto(`${BASE}/login`);
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/01-login.png`, fullPage: true });

// Admin (sees everything)
await login(page, "ha@privilee.ae");
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/02-games.png`, fullPage: true });

await page.goto(`${BASE}/leaderboard`);
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/03-leaderboard.png`, fullPage: true });

await page.goto(`${BASE}/pick-winner`);
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/04-pick-winner.png`, fullPage: true });

await page.goto(`${BASE}/my-bets`);
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/05-my-bets.png`, fullPage: true });

await page.goto(`${BASE}/admin`);
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/06-admin.png`, fullPage: true });

await browser.close();
console.log("screenshots written to", OUT);
