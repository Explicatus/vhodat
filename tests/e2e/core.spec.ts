import { expect, test, type Page } from "@playwright/test";
import { login, newPage, resetDb } from "../helpers";

/** Основни потоци: плащане с карта, известия, банков импорт, протокол, абонамент. */
test.describe.configure({ mode: "serial" });
let m: Page, r: Page;

test.beforeAll(async ({ browser }) => {
  resetDb();
  m = await newPage(browser); r = await newPage(browser);
  await login(m, "manager@demo.bg"); await login(r, "resident@demo.bg");
});

test("собственик плаща с карта (тестов режим) и вижда разписка", async () => {
  await r.goto("/finance");
  await r.fill("input[name=amount]", "5.50");
  await r.getByRole("button", { name: "Плати задължението" }).click();
  await r.waitForURL(/\/pay\/mock\//);
  await r.getByRole("button", { name: /Плати 5,50/ }).click();
  await expect(r.getByText("Плащането е успешно")).toBeVisible();
  await r.getByRole("link", { name: "Разписка" }).click();
  await expect(r.getByRole("heading", { name: "Разписка" })).toBeVisible();
  await expect(r.getByText("5,50 €").first()).toBeVisible();
});

test("отказано плащане не се записва", async () => {
  await r.goto("/finance");
  await r.getByRole("button", { name: /Плати/ }).first().click();
  await r.waitForURL(/\/pay\/mock\//);
  await r.getByRole("button", { name: "Откажи" }).click();
  await expect(r.getByText("Плащането е отказано")).toBeVisible();
});

test("известия: собственикът и управителят са уведомени за плащането", async () => {
  await r.goto("/notifications");
  await expect(r.getByText("Плащането е успешно").first()).toBeVisible();
  await m.goto("/notifications");
  await expect(m.getByText("Онлайн плащане").first()).toBeVisible();
});

test("собственикът няма достъп до управителски страници", async () => {
  for (const path of ["/units", "/billing", "/history", "/settings"]) {
    await r.goto(path);
    await expect(r).toHaveURL(/\/dashboard$/);
  }
  expect((await r.request.get("/api/export/balances")).status()).toBe(403);
});

test("напомняне до длъжниците", async () => {
  await m.goto("/finance");
  await m.getByRole("button", { name: /Напомни на длъжниците/ }).click();
  await expect(m).toHaveURL(/reminded=\d+/);
});

test("банков импорт: автоматично разпознаване и без дублиране", async () => {
  await m.goto("/finance/import");
  await m.setInputFiles("input[type=file]", "tests/fixtures/statement-cp1251.csv");
  await m.getByRole("button", { name: "Прочети извлечението" }).click();
  await expect(m).toHaveURL(/added=3/);
  await expect(m.locator("input[name=txn]:checked")).toHaveCount(2);
  await m.getByRole("button", { name: /Импортирай отметнатите/ }).click();
  await expect(m).toHaveURL(/imported=2/);
  await m.setInputFiles("input[type=file]", "tests/fixtures/statement-cp1251.csv");
  await m.getByRole("button", { name: "Прочети извлечението" }).click();
  await expect(m).toHaveURL(/added=0/);
});

test("протокол от Общо събрание и Книга на ЕС", async () => {
  await m.goto("/polls");
  await m.getByText(/ремонтираме/).click();
  await m.getByRole("link", { name: /Протокол/ }).click();
  await expect(m.getByRole("heading", { name: "Протокол" })).toBeVisible();
  await expect(m.getByText(/кворумът/i).first()).toBeVisible();
  await m.goto("/units/register");
  await expect(m.getByRole("heading", { name: "Книга на етажната собственост" })).toBeVisible();
});

test("абонамент: лимит на безплатния план и надграждане", async () => {
  await m.goto("/billing");
  await expect(m.getByText("Активен")).toBeVisible();
  await m.getByRole("button", { name: "Прекрати абонамента" }).click();
  await expect(m).toHaveURL(/canceled=1/);
  await m.goto("/units");
  await m.locator("form", { has: m.locator("input[name=ownerEmail]") }).locator("input[name=number]").fill("99");
  await m.getByRole("button", { name: "Запази обект" }).click();
  await expect(m).toHaveURL(/billing\?limit=1/);
  await m.goto("/finance/import");
  await expect(m.getByText(/част от плана/)).toBeVisible();
  await m.goto("/billing");
  await m.getByRole("button", { name: "Премини към Професионален" }).click();
  await expect(m).toHaveURL(/success=1/);
  await m.goto("/units");
  await m.locator("form", { has: m.locator("input[name=ownerEmail]") }).locator("input[name=number]").fill("99");
  await m.getByRole("button", { name: "Запази обект" }).click();
  await expect(m.locator('a:text-is("99")')).toBeVisible();
});

test("всички страници се зареждат без грешки", async () => {
  const errors: string[] = [];
  m.on("pageerror", (e) => errors.push(e.message));
  m.on("response", (res) => { if (res.status() >= 500) errors.push(`${res.status()} ${res.url()}`); });
  for (const path of ["/dashboard", "/units", "/finance", "/expenses", "/announcements", "/polls", "/issues", "/notifications", "/settings", "/billing", "/history", "/profile"]) {
    await m.goto(path);
    await expect(m.locator("h1").first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});
