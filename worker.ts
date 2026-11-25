/**
 * Входна точка на Cloudflare Worker-а: страниците минават през OpenNext,
 * а дневният Cron Trigger вика /api/cron (автоматични такси и напомняния).
 */
// @ts-expect-error — файлът се генерира от `opennextjs-cloudflare build`
import handler from "./.open-next/worker.js";

type Env = { APP_URL: string; CRON_SECRET?: string };
type Ctx = { waitUntil(p: Promise<unknown>): void; passThroughOnException(): void };

export default {
  fetch: handler.fetch,
  async scheduled(_controller: unknown, env: Env, ctx: Ctx) {
    if (!env.CRON_SECRET) return console.error("[cron] CRON_SECRET не е зададен");
    const req = new Request(`${env.APP_URL}/api/cron`, { headers: { authorization: `Bearer ${env.CRON_SECRET}` } });
    ctx.waitUntil(
      handler.fetch(req, env, ctx).then(async (res: Response) => console.log("[cron]", res.status, await res.text())),
    );
  },
};
