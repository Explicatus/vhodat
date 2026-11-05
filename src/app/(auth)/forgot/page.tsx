"use client";
import Link from "next/link";
import { useActionState } from "react";
import { requestReset, type ResetState } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";

export default function Forgot() {
  const [state, action] = useActionState<ResetState, FormData>(requestReset, undefined);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form action={action} className="card w-full max-w-sm space-y-4 p-7">
        <h1 className="text-xl font-bold">Забравена парола</h1>
        {state?.sent ? (
          <p className="rounded-xl bg-green-500/15 p-3 text-sm text-green-800">Ако има акаунт с този имейл, изпратихме линк за нова парола. Проверете пощата си (и папка „Спам“).</p>
        ) : (
          <>
            <p className="text-sm text-slate-500">Въведете имейла си и ще ви изпратим линк за нова парола.</p>
            {state?.error && <div className="rounded-xl bg-red-500/15 p-3 text-sm text-red-700">{state.error}</div>}
            <label className="block"><span className="label">Имейл</span><input name="email" type="email" required autoComplete="email" className="input" /></label>
            <SubmitButton className="btn-primary w-full">Изпрати линк</SubmitButton>
          </>
        )}
        <p className="text-center text-sm"><Link href="/login" className="text-brand-600 hover:underline">← Към вход</Link></p>
      </form>
    </div>
  );
}
