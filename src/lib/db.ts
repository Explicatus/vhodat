import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Достъп до базата.
 *
 * Prisma работи без нативен двоичен файл, през драйвера `pg` — същото и в Node.js, и в
 * Cloudflare Workers. В Workers връзка, отворена в една заявка, не може да се ползва в друга,
 * затова там клиентът е отделен за всяка заявка (по ExecutionContext). В Node.js е един общ.
 */
const create = (connectionString: string) => new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const isWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

const g = globalThis as unknown as { prisma?: PrismaClient };
const perRequest = new WeakMap<object, PrismaClient>();

function client(): PrismaClient {
  if (isWorkers) {
    // зарежда се само в Workers; в Node.js не се изпълнява
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require("@opennextjs/cloudflare") as typeof import("@opennextjs/cloudflare");
    const { ctx, env } = getCloudflareContext();
    let c = perRequest.get(ctx);
    if (!c) {
      const url = (env as Record<string, unknown>).DATABASE_URL as string | undefined ?? process.env.DATABASE_URL;
      if (!url) throw new Error("DATABASE_URL не е зададен");
      c = create(url);
      perRequest.set(ctx, c);
    }
    return c;
  }
  if (!g.prisma) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL не е зададен");
    g.prisma = create(process.env.DATABASE_URL);
  }
  return g.prisma;
}

/** Ползва се като обикновен PrismaClient: db.unit.findMany(...), db.$transaction(...). */
export const db = new Proxy({} as PrismaClient, {
  get(_, prop) {
    const c = client();
    const value = Reflect.get(c, prop, c);
    return typeof value === "function" ? value.bind(c) : value;
  },
});
