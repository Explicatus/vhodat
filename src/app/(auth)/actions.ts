"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { clientInfo, createSession, destroySession, hashPassword, revokeAllSessions, verifyPassword } from "@/lib/auth";
import { clearHits, hit, isLimited } from "@/lib/ratelimit";
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
  const { ip } = await clientInfo();
  if (await isLimited(`register:ip:${ip}`, 10, 60)) return { error: "Твърде много регистрации от този адрес. Опитайте по-късно." };
  await hit(`register:ip:${ip}`);
  if (password.length < 8) return { error: "Паролата трябва да е поне 8 символа." };
  if (form.get("terms") !== "on") return { error: "Трябва да приемете Общите условия и Политиката за поверителност." };
  if (await db.user.findUnique({ where: { email } })) return { error: "Вече има регистрация с този имейл." };

  const user = await db.user.create({ data: { name, email, phone, passwordHash: await hashPassword(password), termsAcceptedAt: new Date() } });
  await sendVerification(user.id, user.email);
  await createSession(user.id);
  redirect("/onboarding");
}

export async function login(_: AuthState, form: FormData): Promise<AuthState> {
  const email = str(form, "email").toLowerCase();
  const password = str(form, "password");
  const { ip } = await clientInfo();
  const kEmail = `login:email:${email}`, kIp = `login:ip:${ip}`;
  // до 5 грешни опита за акаунт и 30 от един IP адрес за 15 минути
  if ((await isLimited(kEmail, 5, 15)) || (await isLimited(kIp, 30, 15))) {
    return { error: "Твърде много неуспешни опита. Изчакайте 15 минути или използвайте „Забравена парола“." };
  }
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    await hit(kEmail); await hit(kIp);
    return { error: "Грешен имейл или парола." };
  }
  await clearHits(kEmail);
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
  const { ip } = await clientInfo();
  if (await isLimited(`forgot:ip:${ip}`, 10, 60)) return { error: "Твърде много заявки. Опитайте по-късно." };
  await hit(`forgot:ip:${ip}`);
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
    data: { passwordHash: await hashPassword(password), emailVerifiedAt: new Date() },
  });
  await revokeAllSessions(userId);
  await createSession(userId);
  redirect("/dashboard");
}
