import { expect, test, type Page } from "@playwright/test";
import { lastMail, login, newPage, register, resetDb, row, uniqueEmail } from "../helpers";

/** Пари в центове, корекции, заявки за обект, пароли и имейли. */
test.describe.configure({ mode: "serial" });
let m: Page;

test.beforeAll(async ({ browser }) => {
  resetDb();
  m = await newPage(browser);
  await login(m, "manager@demo.bg");
});

test("еднократна вноска по ид. части: сборът е точно 100,00 €, и се сторнира", async () => {
  await m.goto("/finance");
  const f = m.locator("form", { has: m.locator("input[name=description]") });
  await f.locator("input[name=description]").fill("Тест вноска");
  await f.locator("input[name=total]").fill("100");
  await f.locator("select[name=basis]").selectOption("idealParts");
  await f.getByRole("button").click();
  await expect(row(m, "Тест вноска")).toContainText("100,00");
  await row(m, "Тест вноска").getByRole("button", { name: "Сторнирай" }).click();
  await expect(row(m, "Тест вноска")).toHaveCount(0);
});

test("плащане 12,35 € се пази и показва точно", async () => {
  const f = m.locator("form", { has: m.locator("select[name=unitId]") });
  await f.locator("input[name=amount]").fill("12,35");
  await f.locator("input[name=note]").fill("Центове тест");
  await f.getByRole("button").click();
  await expect(row(m, "Центове тест")).toContainText("12,35");
  expect(await (await m.request.get("/api/export/payments")).text()).toContain('"12,35"');
});

test("задължение към един обект се добавя и изтрива", async () => {
  await m.goto("/units");
  await m.click('a:text-is("3")');
  const f = m.locator("form", { has: m.locator('input[placeholder="Корекция / индивидуална такса"]') });
  await f.locator("input[name=description]").fill("Ключ за мазе");
  await f.locator("input[name=amount]").fill("7,20");
  await f.getByRole("button").click();
  await expect(row(m, "Ключ за мазе")).toContainText("7,20");
  await row(m, "Ключ за мазе").getByRole("button").click();
  await expect(row(m, "Ключ за мазе")).toHaveCount(0);
  await expect(m.locator("input[name=monthlyFee]")).toHaveValue(/^\d+\.\d\d$/);
});

test("разпределение на 100 € по живущи е точно", async () => {
  await m.goto("/units");
  await m.fill("input[name=total]", "100");
  await m.getByRole("button", { name: "Разпредели" }).click();
  await expect(m.locator("tfoot")).toContainText("100,00");
});

const email = uniqueEmail("neighbor");
let n: Page;

test("присъединяване с номер на обект чака одобрение", async ({ browser }) => {
  n = await newPage(browser);
  await register(n, "Нов Съсед", email);
  await n.fill("input[name=code]", "DEMO2026");
  await n.fill("input[name=unit]", "7");
  await n.getByRole("button", { name: "Присъедини се" }).click();
  await n.waitForURL("**/dashboard");
  await expect(n.getByText(/чака одобрение/)).toBeVisible();
  await n.goto("/finance");
  await expect(n.getByText(/не е свързан с обект/)).toBeVisible();
});

test("управителят одобрява и съседът получава достъп", async () => {
  await m.goto("/settings");
  const req = m.locator("li", { hasText: "Нов Съсед → обект 7" });
  await req.getByRole("button", { name: "Одобри" }).click();
  await expect(req).toHaveCount(0);
  await n.goto("/finance");
  await expect(n.getByText("Обект 7").first()).toBeVisible();
  await n.goto("/notifications");
  await expect(n.getByText("Заявката е одобрена")).toBeVisible();
});

test("потвърждаване на имейла; линкът е еднократен", async () => {
  await n.goto("/dashboard");
  await expect(n.getByText("Потвърдете имейла си")).toBeVisible();
  const mail = await lastMail(email, "Потвърдете имейла");
  await n.goto(mail.url);
  await expect(n).toHaveURL(/verify=ok/);
  await expect(n.getByText("Потвърдете имейла си")).toHaveCount(0);
  await n.goto(mail.url);
  await expect(n).toHaveURL(/verify=invalid/);
});

test("забравена парола не издава дали акаунтът съществува", async ({ browser }) => {
  const x = await newPage(browser);
  await x.goto("/forgot");
  await x.fill("input[name=email]", "nobody@nowhere.bg");
  await x.getByRole("button", { name: "Изпрати линк" }).click();
  await expect(x.getByText(/Ако има акаунт/)).toBeVisible();
});

test("нова парола: старите сесии спират, линкът е еднократен", async ({ browser }) => {
  const x = await newPage(browser);
  await x.goto("/forgot");
  await x.fill("input[name=email]", email);
  await x.getByRole("button", { name: "Изпрати линк" }).click();
  const mail = await lastMail(email, "Нова парола");
  await x.goto(mail.url);
  await x.fill("input[name=password]", "newpass456");
  await x.fill("input[name=confirm]", "newpass456");
  await x.getByRole("button", { name: "Запази и влез" }).click();
  await x.waitForURL("**/dashboard");
  await n.goto("/dashboard");
  await expect(n).toHaveURL(/\/login$/);
  await x.goto(mail.url);
  await expect(x.getByText(/невалиден, изтекъл или вече използван/)).toBeVisible();
  await login(await newPage(browser), email, "newpass456");
});

test("различни пароли се отхвърлят", async ({ browser }) => {
  const x = await newPage(browser);
  await x.goto("/forgot");
  await x.fill("input[name=email]", "resident@demo.bg");
  await x.getByRole("button", { name: "Изпрати линк" }).click();
  const mail = await lastMail("resident@demo.bg", "Нова парола");
  await x.goto(mail.url);
  await x.fill("input[name=password]", "aaaaaaaa");
  await x.fill("input[name=confirm]", "bbbbbbbb");
  await x.getByRole("button", { name: "Запази и влез" }).click();
  await expect(x.getByText("Паролите не съвпадат")).toBeVisible();
});

test("плащане с карта 3,33 € се записва точно", async ({ browser }) => {
  const r = await newPage(browser);
  await login(r, "resident@demo.bg");
  await r.goto("/finance");
  await r.fill("input[name=amount]", "3.33");
  await r.getByRole("button", { name: /Плати/ }).first().click();
  await r.waitForURL(/\/pay\/mock\//);
  await r.getByRole("button", { name: /Плати 3,33/ }).click();
  await expect(r.getByText("Плащането е успешно")).toBeVisible();
  await r.goto("/finance");
  await expect(r.locator("tr", { hasText: "Карта" }).filter({ hasText: "3,33" }).first()).toBeVisible();
});
