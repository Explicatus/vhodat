import { requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import { date, EXPENSE_CATEGORIES, money } from "@/lib/format";
import { Card, Empty, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { createExpense, deleteExpense } from "./actions";

export default async function Expenses() {
  const { building, isManager } = await requireMembership();
  const expenses = await db.expense.findMany({ where: { buildingId: building.id }, orderBy: { date: "desc" } });
  const byCat = new Map<string, number>();
  for (const e of expenses) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <>
      <PageHeader title="Разходи" subtitle="Всички разходи на етажната собственост — видими за всички собственици" action={isManager ? <a href="/api/export/expenses" className="btn-secondary">⬇ CSV</a> : undefined} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="История">
            {expenses.length === 0 ? <Empty>Няма регистрирани разходи.</Empty> : (
              <table className="table">
                <thead><tr><th>Дата</th><th>Описание</th><th>Категория</th><th className="text-right">Сума</th>{isManager && <th />}</tr></thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id}>
                      <td className="whitespace-nowrap">{date(e.date)}</td>
                      <td>{e.description}{e.vendor && <div className="text-xs text-slate-400">{e.vendor}</div>}</td>
                      <td className="text-xs">{EXPENSE_CATEGORIES[e.category] ?? e.category}</td>
                      <td className="text-right font-medium">{money(e.amount)}</td>
                      {isManager && <td className="text-right"><form action={deleteExpense.bind(null, e.id)}><SubmitButton className="btn-secondary btn-sm" confirm="Изтриване на разхода?">✕</SubmitButton></form></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="По категории">
            {cats.length === 0 ? <p className="text-sm text-slate-400">—</p> : (
              <ul className="space-y-3">
                {cats.map(([c, v]) => (
                  <li key={c}>
                    <div className="flex justify-between text-sm"><span>{EXPENSE_CATEGORIES[c] ?? c}</span><span className="font-medium">{money(v)}</span></div>
                    <div className="mt-1 h-2 rounded-full bg-slate-500/15"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${(v / total) * 100}%` }} /></div>
                  </li>
                ))}
                <li className="flex justify-between border-t pt-2 font-semibold"><span>Общо</span><span>{money(total)}</span></li>
              </ul>
            )}
          </Card>
          {isManager && (
            <Card title="➕ Нов разход">
              <form action={createExpense} className="space-y-3">
                <label className="block"><span className="label">Описание</span><input name="description" required className="input" placeholder="Ток общи части — октомври" /></label>
                <label className="block"><span className="label">Категория</span>
                  <select name="category" className="input">{Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block"><span className="label">Сума (€)</span><input name="amount" inputMode="decimal" required className="input" /></label>
                  <label className="block"><span className="label">Дата</span><input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="input" /></label>
                </div>
                <label className="block"><span className="label">Доставчик</span><input name="vendor" className="input" /></label>
                <SubmitButton className="btn-primary w-full">Добави</SubmitButton>
              </form>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
