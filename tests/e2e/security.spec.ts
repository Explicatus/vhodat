import { expect, test } from "@playwright/test";
import { login, newPage, resetDb } from "../helpers";

/** Защитни заглавия и Content-Security-Policy. */
test.beforeAll(() => resetDb());

test("страниците връщат защитни заглавия и CSP с уникален nonce", async ({ request }) => {
  const a = await request.get("/login");
  const b = await request.get("/login");
  const h = a.headers();
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["x-powered-by"]).toBeUndefined();
  const csp = h["content-security-policy"];
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).not.toContain("unsafe-eval");
  const nonce = (s: string) => s.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce(csp)).toBeTruthy();
  expect(nonce(csp)).not.toBe(nonce(b.headers()["content-security-policy"]));
  // скриптовете на страницата носят същия nonce
  expect(await a.text()).toContain(`nonce="${nonce(csp)}"`);
  // API отговорите също имат базовите заглавия
  expect((await request.get("/api/cron")).headers()["x-content-type-options"]).toBe("nosniff");
});

test("инжектиран в HTML скрипт (симулирана XSS) се блокира", async ({ browser }) => {
  const page = await newPage(browser);
  // симулираме уязвимост: в HTML отговора на сървъра попада чужд <script> и onerror атрибут,
  // а CSP заглавието остава истинското
  await page.route("**/login", async (route) => {
    const res = await route.fetch();
    const html = (await res.text()).replace("</body>", '<script>window.__xss1=true</script><img src="x:" onerror="window.__xss2=true"></body>');
    await route.fulfill({ response: res, body: html });
  });
  await page.goto("/login");
  await page.waitForTimeout(300);
  const flags = await page.evaluate(() => ({ a: (window as never as { __xss1?: boolean }).__xss1, b: (window as never as { __xss2?: boolean }).__xss2 }));
  expect(flags).toEqual({ a: undefined, b: undefined });
  // а истинската страница продължава да работи (React скриптовете имат nonce)
  await page.fill("input[name=email]", "manager@demo.bg");
  await page.fill("input[name=password]", "demo1234");
  await page.click("button[type=submit]");
  await page.waitForURL("**/dashboard");
});

test("приложението работи без нарушения на CSP", async ({ browser }) => {
  const page = await newPage(browser);
  const violations: string[] = [];
  page.on("console", (msg) => { if (/Content Security Policy|Refused to/i.test(msg.text())) violations.push(msg.text()); });
  await page.addInitScript(() => document.addEventListener("securitypolicyviolation", (e) => console.error(`Refused to load: CSP ${e.violatedDirective} ${e.blockedURI}`)));
  await login(page, "manager@demo.bg");
  for (const path of ["/dashboard", "/finance", "/units", "/polls", "/settings", "/profile", "/history"]) {
    await page.goto(path);
    await expect(page.locator("h1").first()).toBeVisible();
  }
  // интерактивно действие (клиентски JS + server action)
  await page.goto("/announcements");
  await page.fill("input[name=title]", "CSP тест");
  await page.fill("textarea[name=body]", "текст");
  await page.getByRole("button", { name: "Публикувай" }).click();
  await expect(page.getByRole("heading", { name: "CSP тест" })).toBeVisible();
  expect(violations).toEqual([]);
});
