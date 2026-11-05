import Link from "next/link";
import { requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import { unitBalances } from "@/lib/finance";
import { CHARGE_TYPES, euroInput, currentPeriod, date, money, PAYMENT_METHODS, periodLabel } from "@/lib/format";
import { Card, Empty, PageHeader, Stat } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { onlineEnabled, MAX_ONLINE } from "@/lib/payments";
import { startCardPayment } from "@/app/pay/actions";
import { reverseChargeBatch, deletePayment, generateMonthly, oneTimeCharge, recordPayment, remindDebtors } from "./actions";

export default async function Finance() {
  const ctx = await requireMembership();
  return ctx.isManager ? <ManagerFinance buildingId={ctx.building.id} /> : <ResidentFinance unitIds={ctx.unitIds} iban={ctx.building.iban} name={ctx.building.name} online={onlineEnabled(ctx.building)} />;
}

async function ManagerFinance({ buildingId }: { buildingId: string }) {
  const batches = await db.charge.groupBy({
    by: ["period", "type", "description"],
    where: { unit: { buildingId } },
    _sum: { amountCents: true }, _count: { _all: true }, _max: { createdAt: true },
    orderBy: { _max: { createdAt: "desc" } }, take: 8,
  });
  const [balances, payments] = await Promise.all([
    unitBalances(buildingId),
    db.payment.findMany({ where: { unit: { buildingId } }, include: { unit: true }, orderBy: { paidAt: "desc" }, take: 20 }),
  ]);
  const totalDebt = balances.reduce((s, b) => s + Math.max(0, b.balance), 0);
  const totalCharged = balances.reduce((s, b) => s + b.charged, 0);
  const totalPaid = balances.reduce((s, b) => s + b.paid, 0);
  const collection = totalCharged ? Math.round((totalPaid / totalCharged) * 100) : 100;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader title="Такси и плащания" action={
        <div className="flex gap-2">
          <Link href="/finance/import" className="btn-secondary">🏦 Импорт от банка</Link>
          <form action={remindDebtors}><SubmitButton className="btn-secondary" confirm="Да изпратим ли напомняне до всички длъжници?">🔔 Напомни на длъжниците</SubmitButton></form>
          <a href="/api/export/balances" className="btn-secondary">⬇ Салда (CSV)</a>
          <a href="/api/export/payments" className="btn-secondary">⬇ Плащания (CSV)</a>
        </div>
      } />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Общо начислено" value={money(totalCharged)} />
        <Stat label="Общо събрано" value={money(totalPaid)} hint={`Събираемост ${collection}%`} tone="good" />
        <Stat label="Неплатени задължения" value={money(totalDebt)} tone={totalDebt > 0 ? "bad" : "good"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="💰 Регистрирай плащане">
          {balances.length === 0 ? <Empty>Първо добавете обекти.</Empty> : (
            <form action={recordPayment} className="space-y-3">
              <label className="block"><span className="label">Обект</span>
                <select name="unitId" className="input" required>
                  {balances.map((b) => <option key={b.unit.id} value={b.unit.id}>{b.unit.number} — {b.unit.ownerName ?? "—"} (дълг {money(Math.max(0, b.balance))})</option>)}
                </select>
              </label>
              <label className="block"><span className="label">Сума (€)</span><input name="amount" inputMode="decimal" required className="input" /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="label">Начин</span>
                  <select name="method" className="input">{Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                </label>
                <label className="block"><span className="label">Дата</span><input name="paidAt" type="date" defaultValue={today} className="input" /></label>
              </div>
              <label className="block"><span className="label">Бележка</span><input name="note" className="input" /></label>
              <SubmitButton className="btn-primary w-full">Запиши плащане</SubmitButton>
            </form>
          )}
        </Card>
        <Card title="📅 Начисли месечни такси">
          <form action={generateMonthly} className="space-y-3">
            <p className="text-xs text-slate-500">Начислява на всеки обект неговата месечна такса за избрания месец. Повторно натискане не дублира.</p>
            <label className="block"><span className="label">Месец</span><input name="period" type="month" defaultValue={currentPeriod()} required className="input" /></label>
            <label className="block"><span className="label">Фонд „Ремонт“ на обект (€, по желание)</span><input name="repairFund" inputMode="decimal" className="input" placeholder="0" /></label>
            <SubmitButton className="btn-primary w-full">Начисли</SubmitButton>
          </form>
        </Card>
        <Card title="🧱 Еднократна вноска">
          <form action={oneTimeCharge} className="space-y-3">
            <label className="block"><span className="label">Описание</span><input name="description" required placeholder="Ремонт на покрива" className="input" /></label>
            <label className="block"><span className="label">Сума (€)</span><input name="total" inputMode="decimal" required className="input" /></label>
            <label className="block"><span className="label">Как</span>
              <select name="basis" className="input">
                <option value="perUnit">Тази сума на всеки обект</option>
                <option value="idealParts">Обща сума, разпределена по ид. части</option>
              </select>
            </label>
            <SubmitButton className="btn-primary w-full" confirm="Ще бъдат създадени задължения за всички обекти. Продължаване?">Начисли</SubmitButton>
          </form>
        </Card>
      </div>

      <Card title="🧾 Последни начисления" className="mt-6">
        <p className="mb-3 text-xs text-slate-500">Сгрешено начисление? „Сторнирай“ го премахва от всички обекти наведнъж. Отделно задължение се изтрива от страницата на обекта.</p>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Период</th><th>Описание</th><th>Обекти</th><th className="text-right">Общо</th><th /></tr></thead>
            <tbody>
              {batches.map((b) => (
                <tr key={`${b.period}|${b.type}|${b.description}`}>
                  <td className="whitespace-nowrap">{periodLabel(b.period)}</td>
                  <td>{b.description || CHARGE_TYPES[b.type]}</td>
                  <td>{b._count._all}</td>
                  <td className="text-right font-medium">{money(b._sum?.amountCents ?? 0)}</td>
                  <td className="text-right">
                    <form action={reverseChargeBatch.bind(null, b.period, b.type, b.description)}>
                      <SubmitButton className="btn-secondary btn-sm" confirm={`Сторниране на „${b.description}“ за ${b._count._all} обекта?`}>Сторнирай</SubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
              {batches.length === 0 && <tr><td className="text-slate-400">Няма начисления.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Салда по обекти">
          <div className="max-h-[480px] overflow-y-auto">
            <table className="table">
              <thead><tr><th>Обект</th><th className="text-right">Начислено</th><th className="text-right">Платено</th><th className="text-right">Салдо</th></tr></thead>
              <tbody>
                {balances.map((b) => (
                  <tr key={b.unit.id}>
                    <td><Link href={`/units/${b.unit.id}`} className="text-brand-600 hover:underline">{b.unit.number}</Link> <span className="text-xs text-slate-400">{b.unit.ownerName}</span></td>
                    <td className="text-right">{money(b.charged)}</td>
                    <td className="text-right">{money(b.paid)}</td>
                    <td className={`text-right font-medium ${b.balance > 0 ? "text-red-600" : "text-green-600"}`}>{money(b.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Последни плащания">
          {payments.length === 0 ? <Empty>Няма плащания.</Empty> : (
            <table className="table">
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{date(p.paidAt)}</td>
                    <td>Обект {p.unit.number}<div className="text-xs text-slate-400">{PAYMENT_METHODS[p.method]}{p.note ? ` · ${p.note}` : ""}</div></td>
                    <td className="text-right font-medium text-green-700">{money(p.amountCents)}</td>
                    <td className="whitespace-nowrap text-right">
                      <Link href={`/finance/receipt/${p.id}`} className="btn-secondary btn-sm">Разписка</Link>{" "}
                      <form action={deletePayment.bind(null, p.id)} className="inline"><SubmitButton className="btn-secondary btn-sm" confirm="Изтриване на плащането?">✕</SubmitButton></form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}

async function ResidentFinance({ unitIds, iban, name, online }: { unitIds: string[]; iban: string | null; name: string; online: boolean }) {
  if (!unitIds.length) return (<><PageHeader title="Моите задължения" /><Empty>Профилът ви още не е свързан с обект. Свържете се с домоуправителя.</Empty></>);
  const units = await db.unit.findMany({
    where: { id: { in: unitIds } },
    include: { charges: { orderBy: { dueDate: "desc" } }, payments: { orderBy: { paidAt: "desc" } } },
    orderBy: { number: "asc" },
  });
  const rows = units.map((u) => {
    const charged = u.charges.reduce((s, c) => s + c.amountCents, 0);
    const paid = u.payments.reduce((s, p) => s + p.amountCents, 0);
    return { u, charged, paid, balance: charged - paid };
  });
  const total = rows.reduce((a, r) => ({ charged: a.charged + r.charged, paid: a.paid + r.paid, balance: a.balance + r.balance }), { charged: 0, paid: 0, balance: 0 });
  const many = rows.length > 1;
  return (
    <>
      <PageHeader title="Моите задължения" subtitle={many ? `${rows.length} обекта: ${rows.map((r) => r.u.number).join(", ")}` : `Обект ${rows[0].u.number} · месечна такса ${money(rows[0].u.monthlyFeeCents)}`} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label={many ? "Общо салдо" : "Салдо"} value={money(Math.abs(total.balance))} hint={total.balance > 0 ? "Дължима сума" : total.balance < 0 ? "Надплатено" : "Нямате задължения"} tone={total.balance > 0 ? "bad" : "good"} />
        <Stat label="Общо начислено" value={money(total.charged)} />
        <Stat label="Общо платено" value={money(total.paid)} />
      </div>
      {rows.map(({ u, balance }) => (
        <section key={u.id} className="mb-8">
          {many && <h2 className="mb-3 text-lg font-semibold">Обект {u.number} <span className="text-sm font-normal text-slate-500">· такса {money(u.monthlyFeeCents)} · салдо <span className={balance > 0 ? "text-red-600" : "text-green-700"}>{money(balance)}</span></span></h2>}
          {online && (
            <Card title={many ? undefined : "💳 Плащане с карта"} className="mb-4">
              <form action={startCardPayment} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="unitId" value={u.id} />
                <label className="block"><span className="label">{many ? `💳 Плащане с карта за обект ${u.number} (€)` : "Сума (€)"}</span>
                  <input name="amount" type="number" step="0.01" min={1} max={MAX_ONLINE / 100} defaultValue={euroInput(balance > 0 ? balance : u.monthlyFeeCents)} required className="input w-40" />
                </label>
                <SubmitButton>{balance > 0 ? "Плати задължението" : "Плати авансово"}</SubmitButton>
                <span className="text-xs text-slate-500">Visa, Mastercard, Apple Pay, Google Pay · защитено от Stripe</span>
              </form>
            </Card>
          )}
          {balance > 0 && iban && (
            <Card title={many ? undefined : "Банков превод"} className="mb-4">
              <p className="text-sm">Банков превод към <b>{name}</b>, IBAN <b className="font-mono">{iban}</b>, основание: <b>Такса обект {u.number}</b>. Или в брой на домоуправителя.</p>
            </Card>
          )}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Задължения">
              <table className="table"><tbody>
                {u.charges.map((c) => <tr key={c.id}><td>{periodLabel(c.period)}</td><td>{c.description || CHARGE_TYPES[c.type]}</td><td className="text-right">{money(c.amountCents)}</td></tr>)}
                {u.charges.length === 0 && <tr><td className="text-slate-400">Няма</td></tr>}
              </tbody></table>
            </Card>
            <Card title="Плащания">
              <table className="table"><tbody>
                {u.payments.map((p) => <tr key={p.id}><td>{date(p.paidAt)}</td><td>{PAYMENT_METHODS[p.method]}</td><td className="text-right text-green-700">{money(p.amountCents)}</td><td className="text-right"><Link href={`/finance/receipt/${p.id}`} className="text-xs text-brand-600 hover:underline">Разписка</Link></td></tr>)}
                {u.payments.length === 0 && <tr><td className="text-slate-400">Няма</td></tr>}
              </tbody></table>
            </Card>
          </div>
        </section>
      ))}
    </>
  );
}
