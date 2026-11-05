import { expect, test, type Page } from "@playwright/test";
import { CRON_SECRET, login, newPage, register, resetDb, row, uniqueEmail } from "../helpers";

/** Няколко обекта, история, автоматизация, защита на входа, сесии и GDPR. */
test.describe.configure({ mode: "serial" });
let m: Page, r: Page;

test.beforeAll(async ({ browser }) => {
  resetDb();
  m = await newPage(browser); r = await newPage(browser);
  await login(m, "manager@demo.bg"); await login(r, "resident@demo.bg");
});

const residentRow = () => m.locator("tr", { hasText: "resident@demo.bg" });

test("собственик с два обекта: общо салдо, плащане и гласуване поотделно", async () => {
  await m.goto("/settings");
  await residentRow().locator("select[name=addUnitId]").selectOption({ label: "5 · Николай Колев" });
  await residentRow().getByRole("button", { name: "Запази" }).click();
  await expect(residentRow().locator("form.badge", { hasText: "5" })).toBeVisible();

  await r.goto("/finance");
  await expect(r.getByText("2 обекта: 2, 5")).toBeVisible();
  await expect(r.locator("input[name=unitId][type=hidden]")).toHaveCount(2);
  const pay5 = r.locator("form", { has: r.locator("input[name=unitId][type=hidden]") }).nth(1);
  await pay5.locator("input[name=amount]").fill("4.00");
  await pay5.getByRole("button").click();
  await r.waitForURL(/\/pay\/mock\//);
  await expect(r.getByText("Такси — обект 5")).toBeVisible();
  await r.getByRole("button", { name: /Плати 4,00/ }).click();
  await expect(r.getByText("Плащането е успешно")).toBeVisible();

  await r.goto("/polls");
  await r.getByText(/ремонтираме/).click();
  await expect(r.getByText("Гласувам за обекти")).toBeVisible();
  await expect(r.locator("input[name=unitId][type=checkbox]")).toHaveCount(2);
  await r.check("input[name=optionId] >> nth=1");
  await r.getByRole("button", { name: /Гласувай|Промени/ }).click();
  await expect(r.getByText("сега: Против")).toHaveCount(2);

  await m.goto("/settings");
  await residentRow().locator("form.badge", { hasText: "5" }).getByRole("button").click();
  await expect(residentRow().locator("form.badge", { hasText: "5" })).toHaveCount(0);
});

test("история: записва действията, филтрира, експортира; само за управители", async () => {
  await m.goto("/finance");
  const f = m.locator("form", { has: m.locator("select[name=unitId]") });
  await f.locator("input[name=amount]").fill("9,99");
  await f.locator("input[name=note]").fill("за изтриване");
  await f.getByRole("button").click();
  await row(m, "за изтриване").getByRole("button", { name: "✕" }).click();
  await expect(row(m, "за изтриване")).toHaveCount(0);

  await m.goto("/history");
  for (const t of ["Онлайн плащане", "Свързан обект", "Премахнат обект"]) await expect(m.getByText(t).first()).toBeVisible();
  await expect(row(m, "Изтрито плащане").first()).toContainText("9,99");
  await m.goto("/history?g=money");
  await expect(m.getByText("Свързан обект")).toHaveCount(0);
  expect(await (await m.request.get("/api/export/audit")).text()).toContain("Изтрито плащане");
  await r.goto("/history");
  await expect(r).toHaveURL(/\/dashboard$/);
});

test("автоматизация: защитена, начислява веднъж, наваксва", async () => {
  expect((await m.request.get("/api/cron")).status()).toBe(401);
  await m.goto("/settings");
  await m.locator("select[name=autoChargeDay]").selectOption("1");
  await m.fill("input[name=autoRepairFund]", "2");
  await m.locator("select[name=autoRemindDay]").selectOption("1");
  await m.locator("form", { has: m.locator("select[name=autoChargeDay]") }).getByRole("button", { name: "Запази" }).click();
  await expect.poll(async () => { await m.reload(); return m.locator("select[name=autoChargeDay]").inputValue(); }).toBe("1");

  const H = { headers: { authorization: `Bearer ${CRON_SECRET}` } };
  const first = await (await m.request.get("/api/cron", H)).json();
  expect(first.log.join(" ")).toMatch(/charges 12/);
  expect(first.log.join(" ")).toMatch(/reminders/);
  const second = await (await m.request.get("/api/cron", H)).json();
  expect(second.log).toEqual([]);
  await m.goto("/history");
  await expect(m.getByText(/Автоматично начислени такси/)).toBeVisible();
});

test("6-ият опит за вход след 5 грешни пароли е блокиран; другите акаунти не", async ({ browser }) => {
  const x = await newPage(browser);
  for (let i = 0; i < 5; i++) {
    await x.goto("/login");
    await x.fill("input[name=email]", "resident@demo.bg");
    await x.fill("input[name=password]", `wrong${i}`);
    await x.click("button[type=submit]");
    await expect(x.getByText("Грешен имейл или парола")).toBeVisible();
  }
  await x.goto("/login");
  await x.fill("input[name=email]", "resident@demo.bg");
  await x.fill("input[name=password]", "demo1234");
  await x.click("button[type=submit]");
  await expect(x.getByText(/Твърде много неуспешни опита/)).toBeVisible();
  await login(await newPage(browser), "manager@demo.bg");
});

test("устройства: списък, изход от друго устройство, изход само от текущото", async ({ browser }) => {
  const [a, b, c] = [await newPage(browser), await newPage(browser), await newPage(browser)];
  for (const p of [a, b, c]) await login(p, "manager@demo.bg");
  await a.goto("/profile");
  await expect(a.getByText("това устройство")).toBeVisible();
  const others = a.locator("li", { hasText: "последно:" }).filter({ hasNot: a.getByText("това устройство") });
  expect(await others.count()).toBeGreaterThanOrEqual(2);
  await others.first().getByRole("button", { name: "Изход" }).click();
  await expect.poll(async () => {
    let alive = 0;
    for (const p of [b, c]) { await p.goto("/dashboard"); if (!p.url().includes("/login")) alive++; }
    return alive;
  }).toBe(1);
  const survivor = b.url().includes("/login") ? c : b;
  await survivor.locator("aside").getByText("Изход", { exact: true }).click();
  await survivor.waitForURL(/\/$/);
  await a.goto("/dashboard");
  await expect(a).toHaveURL(/\/dashboard$/);
});

test("правни страници и линкове", async ({ browser }) => {
  const x = await newPage(browser);
  await x.goto("/privacy");
  await expect(x.getByRole("heading", { name: "Политика за поверителност" })).toBeVisible();
  await x.goto("/terms");
  await expect(x.getByRole("heading", { name: "Общи условия" })).toBeVisible();
  await x.goto("/");
  await expect(x.locator('footer a[href="/privacy"]')).toBeVisible();
});

test("регистрацията изисква съгласие (и на сървъра)", async ({ browser }) => {
  const x = await newPage(browser);
  await x.goto("/register");
  await x.fill("input[name=name]", "Без съгласие");
  await x.fill("input[name=email]", uniqueEmail("noconsent"));
  await x.fill("input[name=password]", "password123");
  await x.evaluate(() => document.querySelector("input[name=terms]")?.removeAttribute("required"));
  await x.click("button[type=submit]");
  await expect(x.getByText(/Трябва да приемете/)).toBeVisible();
});

test("GDPR: износ на данните и изтриване на профила", async ({ browser }) => {
  const email = uniqueEmail("gdpr");
  const g = await newPage(browser);
  await register(g, "Гдпр Тест", email);
  await g.fill("input[name=code]", "DEMO2026");
  await g.getByRole("button", { name: "Присъедини се" }).click();
  await g.waitForURL("**/dashboard");
  const data = await (await g.request.get("/api/me/export")).json();
  expect(data.profile.email).toBe(email);
  expect(data.profile).not.toHaveProperty("passwordHash");
  expect(data.profile.termsAcceptedAt).toBeTruthy();

  // единственият управител не може да изтрие профила си
  await m.goto("/profile");
  await m.getByRole("button", { name: "Изтрий профила…" }).click();
  await m.fill('form:has(button:has-text("Изтрий завинаги")) input[name=password]', "demo1234");
  await m.getByRole("button", { name: "Изтрий завинаги" }).click();
  await expect(m.getByText(/единственият управител/)).toBeVisible();

  await g.goto("/profile");
  await g.getByRole("button", { name: "Изтрий профила…" }).click();
  await g.fill('form:has(button:has-text("Изтрий завинаги")) input[name=password]', "password123");
  await g.getByRole("button", { name: "Изтрий завинаги" }).click();
  await g.waitForURL(/deleted=1/);
  const x = await newPage(browser);
  await x.goto("/login");
  await x.fill("input[name=email]", email);
  await x.fill("input[name=password]", "password123");
  await x.click("button[type=submit]");
  await expect(x.getByText("Грешен имейл или парола")).toBeVisible();
  await m.goto("/history");
  await expect(m.getByText(/изтрит по негово искане/)).toBeVisible();
});
