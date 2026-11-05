"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { str } from "@/lib/util";
import { createToken, consumeToken, peekToken, recentlySent } from "@/lib/tokens";
import { sendVerification } from "@/lib/verify";
import { sendEmail } from "@/lib/notify";

export type AuthState = { error?: string } | undefined;

export async function register(_: AuthState, form: FormData): Promise<AuthState> {
  const name = str(form, "name");
  const email = str(form, "email").toLowerCase();
  const phone = str(form, "phone") || null;
  const password = str(form, "password");
  if (!name || !email) return { error: "Попълнете име и имейл." };
  if (password.length < 8) return { error: "Паролата трябва да е поне 8 символа." };
  if (await db.user.findUnique({ where: { email } })) return { error: "Вече има регистрация с този имейл." };

  const user = await db.user.create({ data: { name, email, phone, passwordHash: await hashPassword(password) } });
  await sendVerification(user.id, user.email);
  await createSession(user.id);
  redirect("/onboarding");
}

export async function login(_: AuthState, form: FormData): Promise<AuthState> {
  const email = str(form, "email").toLowerCase();
  const password = str(form, "password");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) return { error: "Грешен имейл или парола." };
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/");
}

export type ResetState = { error?: string; sent?: boolean } | undefined;

/** Изпраща линк за нова парола. Не разкрива дали имейлът съществува. */
export async function requestReset(_: ResetState, form: FormData): Promise<ResetState> {
  const email = str(form, "email").toLowerCase();
  if (!email) return { error: "Въведете имейл." };
  const user = await db.user.findUnique({ where: { email } });
  if (user && !(await recentlySent(user.id, "RESET"))) {
    const token = await createToken(user.id, "RESET", 60);
    await sendEmail(user.email, {
      title: "Нова парола за „Входът“",
      body: "Получихме заявка за нова парола. Линкът е валиден 1 час. Ако не сте вие — игнорирайте това писмо, паролата ви остава същата.",
      link: `/reset?token=${token}`,
    }).catch((e) => console.error("[reset mail]", e));
  }
  return { sent: true };
}

export async function resetPassword(_: ResetState, form: FormData): Promise<ResetState> {
  const token = str(form, "token");
  const password = str(form, "password");
  if (password.length < 8) return { error: "Паролата трябва да е поне 8 символа." };
  if (password !== str(form, "confirm")) return { error: "Паролите не съвпадат." };
  if (!(await peekToken(token, "RESET"))) return { error: "Линкът е невалиден или е изтекъл. Поискайте нов." };
  const userId = await consumeToken(token, "RESET");
  if (!userId) return { error: "Линкът вече е използван. Поискайте нов." };
  // смяната на паролата прекратява всички стари сесии; кликът от имейла потвърждава и адреса
  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(password), sessionVersion: { increment: 1 }, emailVerifiedAt: new Date() },
  });
  await createSession(userId);
  redirect("/dashboard");
}
