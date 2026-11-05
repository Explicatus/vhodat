"use client";
import { useActionState, useState } from "react";
import { deleteAccount, type DeleteState } from "../notifications/actions";
import { SubmitButton } from "@/components/SubmitButton";

export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<DeleteState, FormData>(deleteAccount, undefined);
  if (!open) return <button onClick={() => setOpen(true)} className="btn-secondary btn-sm text-red-600">Изтрий профила…</button>;
  return (
    <form action={action} className="space-y-3">
      <p className="text-sm">Името, имейлът и телефонът ви ще бъдат изтрити безвъзвратно. Плащанията и задълженията на обектите остават в счетоводството на етажната собственост.</p>
      {state?.error && <div className="rounded-xl bg-red-500/15 p-3 text-sm text-red-700">{state.error}</div>}
      <label className="block"><span className="label">Потвърдете с паролата си</span><input name="password" type="password" required autoComplete="current-password" className="input" /></label>
      <div className="flex gap-2">
        <SubmitButton className="btn-danger btn-sm" confirm="Сигурни ли сте? Това не може да бъде отменено.">Изтрий завинаги</SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary btn-sm">Отказ</button>
      </div>
    </form>
  );
}
