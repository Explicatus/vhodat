import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { unitBalances } from "@/lib/finance";
import { money, UNIT_KINDS } from "@/lib/format";
import { Card, Empty, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { bulkCreateUnits, createUnit, distributeFees } from "./actions";
import { UnitFields } from "./UnitFields";

export default async function Units() {
  const { building } = await requireManager();
  const rows = await unitBalances(building.id);
  const totals = rows.reduce(
    (a, r) => ({ residents: a.residents + r.unit.residents, fee: a.fee + r.unit.monthlyFee, ideal: a.ideal + r.unit.idealParts }),
    { residents: 0, fee: 0, ideal: 0 },
  );
  return (
    <>
      <PageHeader title="Обекти" subtitle="Апартаменти, магазини, гаражи и техните собственици" />
      <Card className="mb-6">
        {rows.length === 0 ? <Empty>Още няма обекти. Добавете ги по-долу — поотделно или наведнъж.</Empty> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>№</th><th>Вид</th><th>Етаж</th><th>Собственик</th><th>Живущи</th><th>Ид. части</th><th className="text-right">Такса</th><th className="text-right">Салдо</th></tr></thead>
              <tbody>
                {rows.map(({ unit: u, balance }) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td><Link href={`/units/${u.id}`} className="font-medium text-brand-600 hover:underline">{u.number}</Link></td>
                    <td>{UNIT_KINDS[u.kind] ?? u.kind}</td>
                    <td>{u.floor ?? "—"}</td>
                    <td>{u.ownerName ?? "—"}</td>
                    <td>{u.residents}</td>
                    <td>{u.idealParts ? `${u.idealParts}%` : "—"}</td>
                    <td className="text-right">{money(u.monthlyFee)}</td>
                    <td className={`text-right font-medium ${balance > 0 ? "text-red-600" : "text-green-600"}`}>{money(balance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="font-semibold"><td colSpan={4} className="px-3 py-2">Общо {rows.length} обекта</td><td className="px-3">{totals.residents}</td><td className="px-3">{Math.round(totals.ideal * 100) / 100}%</td><td className="px-3 text-right">{money(totals.fee)}</td><td /></tr></tfoot>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="➕ Добави / обнови обект" className="lg:col-span-2">
          <form action={createUnit} className="space-y-4">
            <UnitFields />
            <SubmitButton>Запази обект</SubmitButton>
          </form>
        </Card>
        <Card title="📋 Масово добавяне">
          <form action={bulkCreateUnits} className="space-y-3">
            <p className="text-xs text-slate-500">По един обект на ред: <code>номер; етаж; собственик; живущи; такса; ид.части</code>. Може да поставите директно от Excel.</p>
            <textarea name="rows" rows={6} className="input font-mono text-xs" placeholder={"1; 1; Иван Петров; 3; 12; 4.2\n2; 1; Мария Иванова; 2; 10; 3.8"} />
            <SubmitButton>Импортирай</SubmitButton>
          </form>
        </Card>
        <Card title="⚖️ Разпредели месечната такса">
          <form action={distributeFees} className="space-y-3">
            <p className="text-xs text-slate-500">Въведете общата месечна сума за сградата и тя ще се разпредели между обектите (чл. 51 ЗУЕС — разходите за управление и поддръжка се разпределят по броя на живущите).</p>
            <label className="block"><span className="label">Обща сума на месец (€)</span><input name="total" inputMode="decimal" required className="input" /></label>
            <label className="block"><span className="label">База</span>
              <select name="basis" className="input">
                <option value="residents">По брой живущи</option>
                <option value="idealParts">По идеални части</option>
                <option value="equal">Равни части</option>
              </select>
            </label>
            <SubmitButton confirm="Това ще презапише месечните такси на всички обекти. Продължаване?">Разпредели</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
