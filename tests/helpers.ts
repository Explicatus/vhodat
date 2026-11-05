import { execSync } from "child_process";
import { existsSync, mkdirSync, readFileSync } from "fs";
import { expect, type Browser, type Page } from "@playwright/test";

export const OUTBOX = "test-results/outbox.jsonl";
export const CRON_SECRET = "test-cron-secret";

/** Връща демо данните в начално състояние (сградата DEMO2026, двата демо акаунта, лимитите за вход). */
export function resetDb() {
  mkdirSync("test-results", { recursive: true });
  execSync("npx tsx prisma/seed.ts", { stdio: "pipe" });
}

/** Нов „браузър“ (отделни бисквитки), който приема всички confirm() диалози. */
export async function newPage(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());
  return page;
}

export async function login(page: Page, email: string, password = "demo1234") {
  await page.goto("/login");
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", password);
  await page.click("button[type=submit]");
  await page.waitForURL("**/dashboard");
}

export async function register(page: Page, name: string, email: string, password = "password123") {
  await page.goto("/register");
  await page.fill("input[name=name]", name);
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", password);
  await page.check("input[name=terms]");
  await page.click("button[type=submit]");
  await page.waitForURL("**/onboarding");
}

export const uniqueEmail = (prefix: string) => `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}@test.bg`;

/** Последното писмо до адреса, чието заглавие съдържа `title` (от тестовата пощенска кутия). */
export async function lastMail(to: string, title: string) {
  let found: { url: string; title: string } | undefined;
  await expect.poll(() => {
    if (!existsSync(OUTBOX)) return false;
    const mails = readFileSync(OUTBOX, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
    found = mails.reverse().find((m) => m.to === to && m.title.includes(title));
    return !!found;
  }, { message: `писмо „${title}“ до ${to}` }).toBe(true);
  return found!;
}

/** Текстът на ред от таблица, съдържащ `text`. */
export const row = (page: Page, text: string) => page.locator("tr", { hasText: text });
