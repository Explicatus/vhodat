"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { str } from "@/lib/util";

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
