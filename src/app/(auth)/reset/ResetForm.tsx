"use client";
import { useActionState } from "react";
import { resetPassword, type ResetState } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState<ResetState, FormData>(resetPassword, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state?.error && <div className="rounded-xl bg-red-500/15 p-3 text-sm text-red-700">{state.error}</div>}
      <label className="block"><span className="label">Нова парола (поне 8 символа)</span><input name="password" type="password" minLength={8} required autoComplete="new-password" className="input" /></label>
      <label className="block"><span className="label">Повторете паролата</span><input name="confirm" type="password" minLength={8} required autoComplete="new-password" className="input" /></label>
      <SubmitButton className="btn-primary w-full">Запази и влез</SubmitButton>
      <p className="text-xs text-slate-500">След смяната ще бъдете изведени от всички други устройства.</p>
    </form>
  );
}
