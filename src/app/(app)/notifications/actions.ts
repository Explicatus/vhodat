"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { str } from "@/lib/util";

export async function markAllRead() {
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
}

export async function openNotification(id: string) {
  const user = await requireUser();
  const n = await db.notification.findFirst({ where: { id, userId: user.id } });
  if (!n) return;
  if (!n.readAt) await db.notification.update({ where: { id }, data: { readAt: new Date() } });
  redirect(n.link || "/notifications");
}

export async function updateProfile(form: FormData) {
  const user = await requireUser();
  await db.user.update({
    where: { id: user.id },
    data: {
      name: str(form, "name") || user.name,
      phone: str(form, "phone") || null,
      notifyEmail: form.get("notifyEmail") === "on",
      notifySms: form.get("notifySms") === "on",
      notifyViber: form.get("notifyViber") === "on",
    },
  });
  revalidatePath("/profile");
  redirect("/profile?saved=1");
}

export async function resendVerification() {
  const user = await requireUser();
  const { recentlySent } = await import("@/lib/tokens");
  const { sendVerification } = await import("@/lib/verify");
  if (!user.emailVerifiedAt && !(await recentlySent(user.id, "VERIFY"))) await sendVerification(user.id, user.email);
  redirect("/profile?sent=1");
}

/** Прекратява всички сесии на потребителя (включително текущата). */
export async function logoutEverywhere() {
  const user = await requireUser();
  const { revokeAllSessions } = await import("@/lib/auth");
  await revokeAllSessions(user.id);
  redirect("/login");
}

/** Прекратява една сесия (друго устройство) на текущия потребител. */
export async function revokeSession(id: string) {
  const user = await requireUser();
  await db.session.updateMany({ where: { id, userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  revalidatePath("/profile");
}

export type DeleteState = { error?: string } | undefined;

/**
 * Изтриване на профила (чл. 17 ОРЗД). Личните данни се анонимизират; финансовите записи
 * на обектите остават, защото принадлежат на етажната собственост (и законовите срокове).
 */
export async function deleteAccount(_: DeleteState, form: FormData): Promise<DeleteState> {
  const user = await requireUser();
  const { verifyPassword, destroySession, revokeAllSessions } = await import("@/lib/auth");
  if (!(await verifyPassword(String(form.get("password") ?? ""), user.passwordHash))) return { error: "Грешна парола." };
  const managed = await db.membership.findMany({ where: { userId: user.id, role: "MANAGER" }, include: { building: true } });
  for (const m of managed) {
    const otherManagers = await db.membership.count({ where: { buildingId: m.buildingId, role: "MANAGER", userId: { not: user.id } } });
    const others = await db.membership.count({ where: { buildingId: m.buildingId, userId: { not: user.id } } });
    if (!otherManagers && others) return { error: `Вие сте единственият управител на „${m.building.name}“. Първо направете друг член управител (Настройки → Членове).` };
  }
  const { audit } = await import("@/lib/audit");
  const memberships = await db.membership.findMany({ where: { userId: user.id } });
  for (const m of memberships) await audit(m.buildingId, null, "member.remove", `Профилът на ${user.name} е изтрит по негово искане`);
  const { randomBytes } = await import("crypto");
  await db.$transaction([
    db.membership.deleteMany({ where: { userId: user.id } }),
    db.notification.deleteMany({ where: { userId: user.id } }),
    db.authToken.deleteMany({ where: { userId: user.id } }),
    db.user.update({
      where: { id: user.id },
      data: {
        name: "Изтрит потребител", email: `deleted-${user.id}@deleted.invalid`, phone: null,
        passwordHash: randomBytes(32).toString("hex"), notifyEmail: false, notifySms: false, notifyViber: false,
        emailVerifiedAt: null, deletedAt: new Date(),
      },
    }),
  ]);
  await revokeAllSessions(user.id);
  await destroySession();
  redirect("/?deleted=1");
}
