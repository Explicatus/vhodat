import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "./db";

const SESSION_COOKIE = "es_session";
const BUILDING_COOKIE = "es_building";
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET || "dev-secret-change-me");

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}
export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

/** IP и браузър на текущата заявка (за списъка с устройства и ограничаването на опити). */
export async function clientInfo() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "unknown").trim();
  return { ip, userAgent: h.get("user-agent")?.slice(0, 300) ?? null };
}

export async function createSession(userId: string) {
  const { ip, userAgent } = await clientInfo();
  const session = await db.session.create({ data: { userId, ip, userAgent } });
  const token = await new SignJWT({ sub: userId, sid: session.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

async function currentSessionId() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.sid === "string" ? { sid: payload.sid, sub: payload.sub } : null;
  } catch {
    return null;
  }
}

/** Изход: прекратява само текущото устройство. */
export async function destroySession() {
  const cur = await currentSessionId();
  if (cur) await db.session.updateMany({ where: { id: cur.sid, revokedAt: null }, data: { revokedAt: new Date() } });
  const c = await cookies();
  c.delete(SESSION_COOKIE);
  c.delete(BUILDING_COOKIE);
}

/** Прекратява всички сесии на потребителя (смяна на парола, „изход от всички устройства“). */
export async function revokeAllSessions(userId: string) {
  await db.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function getCurrentSessionId() {
  return (await currentSessionId())?.sid ?? null;
}

/** Текущият потребител. Кеширано в рамките на една заявка. */
export const getCurrentUser = cache(async () => {
  const cur = await currentSessionId();
  if (!cur) return null;
  const session = await db.session.findUnique({ where: { id: cur.sid }, include: { user: true } });
  // прекратена или чужда сесия → невалидна
  if (!session || session.revokedAt || session.userId !== cur.sub) return null;
  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60_000) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return session.user;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function setCurrentBuilding(buildingId: string) {
  (await cookies()).set(BUILDING_COOKIE, buildingId, { httpOnly: true, sameSite: "lax", path: "/" });
}

/** Текущият потребител + активната етажна собственост и ролята му в нея. */
export async function requireMembership() {
  const user = await requireUser();
  const memberships = await db.membership.findMany({
    where: { userId: user.id },
    include: { building: true, units: { include: { unit: true }, orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  if (memberships.length === 0) redirect("/onboarding");
  const wanted = (await cookies()).get(BUILDING_COOKIE)?.value;
  const membership = memberships.find((m) => m.buildingId === wanted) ?? memberships[0];
  // обектите на потребителя в текущата етажна собственост (напр. апартамент + гараж)
  const units = membership.units.map((mu) => mu.unit);
  return {
    user,
    membership,
    memberships,
    units,
    unitIds: units.map((u) => u.id),
    building: membership.building,
    isManager: membership.role === "MANAGER",
  };
}

export async function requireManager() {
  const ctx = await requireMembership();
  if (!ctx.isManager) redirect("/dashboard");
  return ctx;
}
