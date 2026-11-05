import "server-only";
import { cookies } from "next/headers";
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

export async function createSession(userId: string) {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { sessionVersion: true } });
  const token = await new SignJWT({ sub: userId, sv: u.sessionVersion })
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

export async function destroySession() {
  const c = await cookies();
  c.delete(SESSION_COOKIE);
  c.delete(BUILDING_COOKIE);
}

export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    const user = await db.user.findUnique({ where: { id: payload.sub } });
    // сесия, издадена преди смяна на паролата / изход от всички устройства, е невалидна
    if (!user || (payload.sv ?? 0) !== user.sessionVersion) return null;
    return user;
  } catch {
    return null;
  }
}

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
    include: { building: true, unit: true },
    orderBy: { createdAt: "asc" },
  });
  if (memberships.length === 0) redirect("/onboarding");
  const wanted = (await cookies()).get(BUILDING_COOKIE)?.value;
  const membership = memberships.find((m) => m.buildingId === wanted) ?? memberships[0];
  return {
    user,
    membership,
    memberships,
    building: membership.building,
    isManager: membership.role === "MANAGER",
  };
}

export async function requireManager() {
  const ctx = await requireMembership();
  if (!ctx.isManager) redirect("/dashboard");
  return ctx;
}
