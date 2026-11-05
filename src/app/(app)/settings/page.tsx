import { requireManager } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { connectStripe, decideUnitRequest, regenerateInvite, removeMember, stripeDashboard, updateBuilding, updateMember } from "./actions";
import { mockMode, platformFeePercent, stripeConfigured } from "@/lib/payments";

export default async function Settings() {
  const { building, membership: me } = await requireManager();
  const [members, units] = await Promise.all([
    db.membership.findMany({ where: { buildingId: building.id }, include: { user: true, unit: true }, orderBy: { createdAt: "asc" } }),
    db.unit.findMany({ where: { buildingId: building.id }, orderBy: { number: "asc" } }),
  ]);
  const requests = members.filter((m) => m.requestedUnitId);
  const unitById = new Map(units.map((u) => [u.id, u]));
  return (
    <>
      <PageHeader title="Настройки" />
      {requests.length > 0 && (
        <Card title={`🙋 Заявки за свързване с обект (${requests.length})`} className="mb-6 ring-2 ring-amber-400/60">
          <p className="mb-3 text-sm text-slate-500">Проверете, че човекът наистина е собственик или обитател на обекта, преди да одобрите — след одобрение вижда задълженията и гласува от името на обекта.</p>
          <ul className="space-y-2">
            {requests.map((m) => {
              const u = unitById.get(m.requestedUnitId!);
              return (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/40 bg-white/20 p-3">
                  <div className="text-sm">
                    <div className="font-semibold">{m.user.name} → обект {u?.number ?? "?"}</div>
                    <div className="text-xs text-slate-500">{m.user.email}{m.user.phone ? ` · ${m.user.phone}` : ""}{u?.ownerName ? ` · собственик по книга: ${u.ownerName}` : ""}{u?.ownerEmail && u.ownerEmail.toLowerCase() === m.user.email.toLowerCase() ? " · ✅ имейлът съвпада" : ""}</div>
                  </div>
                  <div className="flex gap-2">
                    <form action={decideUnitRequest.bind(null, m.id, true)}><SubmitButton className="btn-primary btn-sm">Одобри</SubmitButton></form>
                    <form action={decideUnitRequest.bind(null, m.id, false)}><SubmitButton className="btn-secondary btn-sm" confirm="Отхвърляне на заявката?">Отхвърли</SubmitButton></form>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Етажна собственост">
          <form action={updateBuilding} className="space-y-3">
            <label className="block"><span className="label">Име</span><input name="name" defaultValue={building.name} className="input" /></label>
            <label className="block"><span className="label">Адрес</span><input name="address" defaultValue={building.address} className="input" /></label>
            <label className="block"><span className="label">Град</span><input name="city" defaultValue={building.city} className="input" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="label">БУЛСТАТ</span><input name="bulstat" defaultValue={building.bulstat ?? ""} className="input" /></label>
              <label className="block"><span className="label">IBAN</span><input name="iban" defaultValue={building.iban ?? ""} className="input" /></label>
            </div>
            <SubmitButton>Запази</SubmitButton>
          </form>
        </Card>
        <Card title="🔑 Покана за живущите">
          <p className="text-sm text-slate-600">Споделете този код с собствениците. Те се регистрират и въвеждат кода и номера на своя обект.</p>
          <div className="my-4 rounded-xl bg-brand-500/10 p-4 text-center font-mono text-3xl font-bold tracking-widest text-brand-700">{building.inviteCode}</div>
          <form action={regenerateInvite}><SubmitButton className="btn-secondary btn-sm" confirm="Старият код ще спре да работи. Продължаване?">Генерирай нов код</SubmitButton></form>
        </Card>
        <Card title="💳 Онлайн плащания с карта" className="lg:col-span-2">
          {mockMode() ? (
            <p className="text-sm text-amber-700">🧪 <b>Тестов режим</b> — собствениците могат да „плащат“ с карта без реален Stripe. За реални плащания задайте <code>STRIPE_SECRET_KEY</code> и изключете <code>PAYMENTS_MOCK</code>.</p>
          ) : !stripeConfigured() ? (
            <p className="text-sm text-slate-600">Онлайн плащанията не са конфигурирани на сървъра (липсва <code>STRIPE_SECRET_KEY</code>).</p>
          ) : building.stripeChargesEnabled ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-green-700">✅ Активни. Собствениците плащат с карта, Apple Pay и Google Pay, а парите постъпват директно в банковата сметка на етажната собственост.</p>
              <form action={stripeDashboard}><SubmitButton className="btn-secondary">Stripe табло →</SubmitButton></form>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                {building.stripeAccountId ? "Настройката не е завършена — Stripe чака още данни." : "Свържете банковата сметка на ЕС чрез Stripe (≈5 мин.). Парите от плащанията постъпват директно при вас."}
              </p>
              <form action={connectStripe}><SubmitButton>{building.stripeAccountId ? "Продължи настройката" : "Свържи Stripe"}</SubmitButton></form>
            </div>
          )}
          {platformFeePercent() > 0 && <p className="mt-2 text-xs text-slate-400">Такса на платформата: {platformFeePercent()}% от всяко онлайн плащане (плюс таксата на Stripe).</p>}
        </Card>
        <Card title="👥 Членове" className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Име</th><th>Имейл</th><th>Роля</th><th>Обект</th><th /></tr></thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td className="font-medium">{m.user.name}{m.id === me.id && <span className="text-xs text-slate-400"> (вие)</span>}</td>
                    <td className="text-xs">{m.user.email}{m.user.phone && <div className="text-slate-400">{m.user.phone}</div>}</td>
                    <td colSpan={2}>
                      <form action={updateMember.bind(null, m.id)} className="flex gap-2">
                        <select name="role" defaultValue={m.role} className="input w-36 text-xs" disabled={m.id === me.id}>
                          <option value="RESIDENT">Обитател</option>
                          <option value="MANAGER">Управител</option>
                        </select>
                        <select name="unitId" defaultValue={m.unitId ?? ""} className="input w-40 text-xs">
                          <option value="">— без обект —</option>
                          {units.map((u) => <option key={u.id} value={u.id}>{u.number} {u.ownerName ? `· ${u.ownerName}` : ""}</option>)}
                        </select>
                        <SubmitButton className="btn-secondary btn-sm">Запази</SubmitButton>
                      </form>
                    </td>
                    <td className="text-right">
                      {m.id !== me.id && <form action={removeMember.bind(null, m.id)}><SubmitButton className="btn-secondary btn-sm" confirm="Премахване от етажната собственост?">✕</SubmitButton></form>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
