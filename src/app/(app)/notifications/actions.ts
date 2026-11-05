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
  await db.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
  redirect("/login");
}
