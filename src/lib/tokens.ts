import "server-only";
import { createHash, randomBytes } from "crypto";
import { db } from "./db";

export type TokenType = "RESET" | "VERIFY";
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

/** Създава еднократен токен и връща суровата стойност (само тя отива в линка). */
export async function createToken(userId: string, type: TokenType, ttlMinutes: number) {
  // старите неизползвани токени от същия тип стават невалидни
  await db.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } });
  const raw = randomBytes(32).toString("base64url");
  await db.authToken.create({ data: { userId, type, tokenHash: hash(raw), expiresAt: new Date(Date.now() + ttlMinutes * 60_000) } });
  return raw;
}

/** Проверява токена без да го изразходва. */
export async function peekToken(raw: string, type: TokenType) {
  if (!raw) return null;
  const t = await db.authToken.findUnique({ where: { tokenHash: hash(raw) } });
  return t && t.type === type && !t.usedAt && t.expiresAt > new Date() ? t : null;
}

/** Изразходва токена атомарно — работи само веднъж. Връща userId или null. */
export async function consumeToken(raw: string, type: TokenType) {
  const t = await peekToken(raw, type);
  if (!t) return null;
  const r = await db.authToken.updateMany({ where: { id: t.id, usedAt: null }, data: { usedAt: new Date() } });
  return r.count === 1 ? t.userId : null;
}

/** Не позволява повече от 1 изпращане на минута за потребител и тип. */
export async function recentlySent(userId: string, type: TokenType) {
  return !!(await db.authToken.findFirst({ where: { userId, type, createdAt: { gt: new Date(Date.now() - 60_000) } } }));
}
