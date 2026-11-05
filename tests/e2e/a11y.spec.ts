import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser } from "@playwright/test";
import { login, resetDb } from "../helpers";

/**
 * Достъпност (WCAG 2.1 AA) на основните страници в светъл и тъмен режим:
 * контраст, етикети на полета, имена на бутони и линкове и т.н.
 */
test.beforeAll(() => resetDb());

const PAGES = {
  manager: ["/dashboard", "/finance", "/units", "/expenses", "/announcements", "/polls", "/issues", "/settings", "/billing", "/history", "/profile", "/notifications"],
  resident: ["/dashboard", "/finance"],
  public: ["/", "/login", "/register", "/forgot", "/privacy"],
};

async function scan(browser: Browser, scheme: "light" | "dark", who: keyof typeof PAGES) {
  const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  if (who !== "public") await login(page, who === "manager" ? "manager@demo.bg" : "resident@demo.bg");
  const problems: string[] = [];
  for (const path of PAGES[who]) {
    await page.goto(path);
    // изчакваме анимациите, за да се мери крайният цвят
    await page.waitForTimeout(300);
    // axe-core носи собствени типове на Playwright — съвместими са по време на изпълнение
    const res = await new AxeBuilder({ page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]["page"] }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    for (const v of res.violations) {
      for (const n of v.nodes.slice(0, 3)) problems.push(`${scheme} ${path} [${v.id}] ${n.target.join(" ")} — ${n.failureSummary?.split("\n")[1]?.trim() ?? ""}`);
    }
  }
  await ctx.close();
  return problems;
}

for (const scheme of ["light", "dark"] as const) {
  for (const who of ["public", "manager", "resident"] as const) {
    test(`${scheme}: ${who} страници без нарушения на WCAG AA`, async ({ browser }) => {
      const problems = await scan(browser, scheme, who);
      expect(problems, problems.join("\n")).toEqual([]);
    });
  }
}

test("„Едър текст“ увеличава шрифта и се запомня за устройството", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, "resident@demo.bg");
  const rootSize = () => page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
  expect(await rootSize()).toBe("16px");
  await page.goto("/profile");
  await page.getByRole("button", { name: "Едър" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-text", "lg");
  expect(await rootSize()).toBe("18px");
  await page.goto("/finance");
  expect(await rootSize()).toBe("18px");
  await page.goto("/profile");
  await page.getByRole("button", { name: "Нормален" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-text", "lg");
  await ctx.close();
});
