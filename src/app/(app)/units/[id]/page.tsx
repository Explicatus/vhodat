import Link from "next/link";
import { notFound } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { db } from "@/lib/db";
import { CHARGE_TYPES, date, money, PAYMENT_METHODS, periodLabel } from "@/lib/format";
import { Card, PageHeader, Stat } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { deleteUnit, updateUnit } from "../actions";
import { UnitFields } from "../UnitFields";

export default async function UnitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { building } = await requireManager();
  const unit = await db.unit.findFirst({
    where: { id, buildingId: building.id },
    include: {
      charges: { orderBy: { dueDate: "desc" } },
      payments: { orderBy: { paidAt: "desc" } },
      memberships: { include: { user: true } },
    },
  });
  if (!unit) notFound();
  const charged = unit.charges.reduce((s, c) => s + c.amount, 0);
  const paid = unit.payments.reduce((s, p) => s + p.amount, 0);
  const balance = Math.round((charged - paid) * 100) / 100;

  return (
    <>
      <PageHeader title={`Обект ${unit.number}`} subtitle={unit.ownerName ?? undefined} action={<Link href="/units" className="btn-secondary">← Обекти</Link>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Начислено" value={money(charged)} />
        <Stat label="Платено" value={money(paid)} />
        <Stat label="Салдо" value={money(balance)} tone={balance > 0 ? "bad" : "good"} hint={balance > 0 ? "Дължи" : "Няма задължения"} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Задължения">
          <table className="table">
            <tbody>
              {unit.charges.map((c) => (
                <tr key={c.id}><td>{periodLabel(c.period)}</td><td>{c.description || CHARGE_TYPES[c.type]}</td><td className="text-right">{money(c.amount)}</td></tr>
              ))}
              {unit.charges.length === 0 && <tr><td className="text-slate-400">Няма</td></tr>}
            </tbody>
          </table>
        </Card>
        <Card title="Плащания">
          <table className="table">
            <tbody>
              {unit.payments.map((p) => (
                <tr key={p.id}><td>{date(p.paidAt)}</td><td>{PAYMENT_METHODS[p.method]}{p.note ? ` · ${p.note}` : ""}</td><td className="text-right text-green-700">{money(p.amount)}</td></tr>
              ))}
              {unit.payments.length === 0 && <tr><td className="text-slate-400">Няма</td></tr>}
            </tbody>
          </table>
        </Card>
        <Card title="Свързани потребители" className="lg:col-span-2">
          {unit.memberships.length === 0 ? <p className="text-sm text-slate-500">Никой не е свързан. Свържете потребители от „Настройки → Членове“.</p> : (
            <ul className="text-sm">{unit.memberships.map((m) => <li key={m.id}>{m.user.name} · {m.user.email}</li>)}</ul>
          )}
        </Card>
        <Card title="Редакция" className="lg:col-span-2">
          <form action={updateUnit.bind(null, unit.id)} className="space-y-4">
            <UnitFields u={unit} />
            <SubmitButton>Запази</SubmitButton>
          </form>
          <form action={deleteUnit.bind(null, unit.id)} className="mt-4 border-t pt-4">
            <SubmitButton className="btn-danger btn-sm" confirm="Изтриване на обекта и цялата му история?">Изтрий обекта</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
