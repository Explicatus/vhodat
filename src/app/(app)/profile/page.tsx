import { requireMembership } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { logoutEverywhere, resendVerification, revokeSession, updateProfile } from "../notifications/actions";
import { db } from "@/lib/db";
import { DeleteAccount } from "./DeleteAccount";
import { getCurrentSessionId } from "@/lib/auth";
import { dateTime } from "@/lib/format";

export default async function Profile({ searchParams }: { searchParams: Promise<{ saved?: string; sent?: string }> }) {
  const { user } = await requireMembership();
  const { saved, sent } = await searchParams;
  const [sessions, currentSid] = await Promise.all([
    db.session.findMany({ where: { userId: user.id, revokedAt: null }, orderBy: { lastSeenAt: "desc" }, take: 20 }),
    getCurrentSessionId(),
  ]);
  const device = (ua: string | null) => {
    if (!ua) return "Неизвестно устройство";
    const os = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Устройство";
    const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "браузър";
    return `${br} · ${os}`;
  };
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
          <p className="text-sm text-slate-500">Активни входове в профила ви:</p>
          <ul className="my-3 space-y-2">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/40 bg-white/20 px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{device(s.userAgent)} {s.id === currentSid && <span className="badge bg-green-500/15 text-green-700">това устройство</span>}</div>
                  <div className="text-xs text-slate-500">последно: {dateTime(s.lastSeenAt)} · IP {s.ip}</div>
                </div>
                {s.id !== currentSid && <form action={revokeSession.bind(null, s.id)}><SubmitButton className="btn-secondary btn-sm">Изход</SubmitButton></form>}
              </li>
            ))}
          </ul>
          <p className="text-sm text-slate-500">Изгубен телефон или вход от чужд компютър? Излезте от всички устройства наведнъж.</p>
          <form action={logoutEverywhere} className="mt-3"><SubmitButton className="btn-secondary btn-sm" confirm="Изход от всички устройства, включително това?">Изход от всички устройства</SubmitButton></form>
        </Card>
        <Card title="🛡️ Вашите данни (GDPR)" className="lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xl text-sm text-slate-500">
              Изтеглете копие на всичко, което пазим за вас, или изтрийте профила си. Повече в <a href="/privacy" className="text-brand-600 underline">Политиката за поверителност</a>.
            </div>
            <div className="flex flex-col items-end gap-2">
              <a href="/api/me/export" className="btn-secondary btn-sm">⬇ Изтегли моите данни</a>
              <DeleteAccount />
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
