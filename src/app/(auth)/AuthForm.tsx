"use client";
import Link from "next/link";
import { useActionState } from "react";
import { login, register, type AuthState } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [state, action] = useActionState<AuthState, FormData>(mode === "login" ? login : register, undefined);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2 text-2xl font-bold"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-600 text-white shadow-lg shadow-indigo-500/30">⌂</span>Входът</Link>
        <form action={action} className="card space-y-4 p-7">
          <h1 className="text-xl font-bold">{mode === "login" ? "Вход" : "Създайте акаунт"}</h1>
          {state?.error && <div className="rounded-lg bg-red-500/15 p-3 text-sm text-red-700">{state.error}</div>}
          {mode === "register" && (
            <>
              <label className="block"><span className="label">Име и фамилия</span><input name="name" required className="input" /></label>
              <label className="block"><span className="label">Телефон (по желание)</span><input name="phone" className="input" /></label>
            </>
          )}
          <label className="block"><span className="label">Имейл</span><input name="email" type="email" required className="input" /></label>
          <label className="block"><span className="label">Парола</span><input name="password" type="password" required className="input" /></label>
          <SubmitButton className="btn-primary w-full">{mode === "login" ? "Вход" : "Регистрация"}</SubmitButton>
          <p className="text-center text-sm text-slate-500">
            {mode === "login" ? (
              <>Нямате акаунт? <Link href="/register" className="text-brand-600 hover:underline">Регистрация</Link></>
            ) : (
              <>Имате акаунт? <Link href="/login" className="text-brand-600 hover:underline">Вход</Link></>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
