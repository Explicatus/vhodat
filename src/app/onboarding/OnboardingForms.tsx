"use client";
import { useActionState } from "react";
import { createBuilding, joinBuilding, type OnbState } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export function OnboardingForms() {
  const [cState, cAction] = useActionState<OnbState, FormData>(createBuilding, undefined);
  const [jState, jAction] = useActionState<OnbState, FormData>(joinBuilding, undefined);
  return (
    <div className="mt-8 grid gap-6 md:grid-cols-2">
      <form action={cAction} className="card space-y-3">
        <h2 className="text-lg font-semibold">🏢 Нова етажна собственост</h2>
        <p className="text-sm text-slate-500">Ще бъдете управител с пълни права.</p>
        {cState?.error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{cState.error}</div>}
        <label className="block"><span className="label">Име</span><input name="name" placeholder="ЕС бл. 12, вх. А" required className="input" /></label>
        <label className="block"><span className="label">Адрес</span><input name="address" placeholder="ж.к. Младост 1, бл. 12" required className="input" /></label>
        <label className="block"><span className="label">Град</span><input name="city" defaultValue="София" required className="input" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="label">БУЛСТАТ</span><input name="bulstat" className="input" /></label>
          <label className="block"><span className="label">IBAN</span><input name="iban" className="input" /></label>
        </div>
        <SubmitButton className="btn-primary w-full">Създай</SubmitButton>
      </form>
      <form action={jAction} className="card space-y-3">
        <h2 className="text-lg font-semibold">🔑 Присъединяване с код</h2>
        <p className="text-sm text-slate-500">Кодът е при вашия домоуправител.</p>
        {jState?.error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{jState.error}</div>}
        <label className="block"><span className="label">Код за покана</span><input name="code" required className="input uppercase" /></label>
        <label className="block"><span className="label">Номер на вашия обект (ап.)</span><input name="unit" placeholder="напр. 7" className="input" /></label>
        <SubmitButton className="btn-primary w-full">Присъедини се</SubmitButton>
      </form>
    </div>
  );
}
