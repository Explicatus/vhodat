import { requireMembership } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { logoutEverywhere, resendVerification, updateProfile } from "../notifications/actions";

export default async function Profile({ searchParams }: { searchParams: Promise<{ saved?: string; sent?: string }> }) {
  const { user } = await requireMembership();
  const { saved, sent } = await searchParams;
  return (
    <>
      <PageHeader title="Моят профил" subtitle={user.email} />
      {saved && <div className="mb-4 rounded-xl bg-green-500/15 p-3 text-sm text-green-700">✓ Запазено</div>}
      <form action={updateProfile} className="grid gap-6 lg:grid-cols-2">
        <Card title="Лични данни">
          <div className="space-y-3">
            <label className="block"><span className="label">Име</span><input name="name" defaultValue={user.name} className="input" /></label>
            <label className="block"><span className="label">Мобилен телефон (за SMS и Viber)</span><input name="phone" defaultValue={user.phone ?? ""} placeholder="0888 123 456" className="input" /></label>
          </div>
        </Card>
        <Card title="🔔 Как да ви известяваме?">
          <p className="mb-3 text-sm text-slate-500">Известията винаги се виждат в приложението. Изберете допълнителни канали:</p>
          <div className="space-y-2">
            {[
              ["notifyEmail", "📧 Имейл", user.notifyEmail],
              ["notifySms", "💬 SMS", user.notifySms],
              ["notifyViber", "🟣 Viber", user.notifyViber],
            ].map(([k, l, v]) => (
              <label key={k as string} className="flex items-center justify-between rounded-xl border border-white/40 bg-white/30 p-3 text-sm">
                <span>{l}</span><input type="checkbox" name={k as string} defaultChecked={v as boolean} className="h-5 w-5 accent-brand-600" />
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">SMS и Viber изискват телефонен номер и са налични, когато етажната собственост е на план „Професионален“.</p>
        </Card>
        <div className="lg:col-span-2"><SubmitButton>Запази</SubmitButton></div>
      </form>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="📧 Имейл">
          {user.emailVerifiedAt ? <p className="text-sm text-green-700">✅ Имейлът {user.email} е потвърден.</p> : (
            <>
              <p className="text-sm text-amber-700">Имейлът {user.email} не е потвърден.</p>
              {sent && <p className="mt-1 text-xs text-slate-500">Изпратихме нов линк (ако не сме пратили такъв през последната минута).</p>}
              <form action={resendVerification} className="mt-3"><SubmitButton className="btn-secondary btn-sm">Изпрати линка отново</SubmitButton></form>
            </>
          )}
        </Card>
        <Card title="🔐 Сигурност">
          <p className="text-sm text-slate-500">Изгубен телефон или вход от чужд компютър? Излезте от всички устройства наведнъж.</p>
          <form action={logoutEverywhere} className="mt-3"><SubmitButton className="btn-secondary btn-sm" confirm="Изход от всички устройства, включително това?">Изход от всички устройства</SubmitButton></form>
        </Card>
      </div>
    </>
  );
}
