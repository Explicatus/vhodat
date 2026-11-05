import "server-only";
import { db } from "./db";

/** Има ли поне `limit` опита с този ключ през последните `minutes` минути? */
export async function isLimited(key: string, limit: number, minutes: number) {
  const n = await db.rateLimitHit.count({ where: { key, createdAt: { gt: new Date(Date.now() - minutes * 60_000) } } });
  return n >= limit;
}
export const hit = (key: string) => db.rateLimitHit.create({ data: { key } });
export const clearHits = (key: string) => db.rateLimitHit.deleteMany({ where: { key } });
/** Почистване на стари записи (извиква се от дневната задача). */
export const pruneHits = () => db.rateLimitHit.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 3600_000) } } });
