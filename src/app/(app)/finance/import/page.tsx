import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { db } from "@/lib/db";
import { date, money } from "@/lib/format";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { isPro } from "@/lib/billing";
import { confirmTxns, ignoreTxn, uploadStatement } from "./actions";

export default async function ImportPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { building } = await requireManager();
  if (!isPro(building)) return (
    <>
      <PageHeader title="Импорт на банково извлечение" />
      <Card><p className="text-sm">Импортът на банкови извлечения е част от плана „Професионален“.</p><Link href="/billing" className="btn-primary mt-4">Виж плановете</Link></Card>
    </>
  );
  const [txns, units, recent] = await Promise.all([
    db.bankTxn.findMany({ where: { buildingId: building.id, status: "NEW" }, orderBy: { date: "desc" } }),
    db.unit.findMany({ where: { buildingId: building.id }, orderBy: { number: "asc" } }),
    db.bankTxn.count({ where: { buildingId: building.id, status: "IMPORTED" } }),
  ]);
  return (
    <>
      <PageHeader title="Импорт на банково извлечение" subtitle="Качете CSV от онлайн банкирането — системата сама разпознава кой е платил" action={<Link href="/finance" className="btn-secondary">← Плащания</Link>} />
      {sp.err && <div className="mb-4 rounded-xl bg-red-500/15 p-3 text-sm text-red-700">{sp.err}</div>}
      {sp.added && <div className="mb-4 rounded-xl bg-green-500/15 p-3 text-sm text-green-800">Прочетени {sp.total} постъпления, нови: {sp.added} (дубликатите се пропускат автоматично).</div>}
      {sp.imported && <div className="mb-4 rounded-xl bg-green-500/15 p-3 text-sm text-green-800">✓ Импортирани {sp.imported} плащания.</div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="📄 Качване">
          <form action={uploadStatement} className="space-y-3">
            <input type="file" name="file" accept=".csv,.txt,text/csv" required className="input" />
            <SubmitButton className="btn-primary w-full">Прочети извлечението</SubmitButton>
          </form>
          <div className="mt-4 space-y-1 text-xs text-slate-500">
            <p>Поддържа CSV от ДСК, УниКредит, ОББ, Пощенска, Fibank и др. (UTF-8 или Windows-1251, разделител <code>;</code> <code>,</code> или таб).</p>
            <p>Нужни колони: <b>Дата</b>, <b>Сума</b> или <b>Кредит</b>, по желание <b>Основание</b> и <b>Наредител</b>.</p>
            <p>💡 Помолете съседите да пишат в основанието „<b>ап. 5</b>“ — тогава разпознаването е 100%.</p>
            <p>Общо импортирани досега: {recent}.</p>
          </div>
        </Card>
        <Card title={`Чакащи потвърждение (${txns.length})`} className="lg:col-span-2">
          {txns.length === 0 ? <Empty>Няма непотвърдени постъпления.</Empty> : (
            <form action={confirmTxns} className="space-y-3">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th /><th>Дата</th><th>Наредител / основание</th><th className="text-right">Сума</th><th>Обект</th><th /></tr></thead>
                  <tbody>
                    {txns.map((t) => (
                      <tr key={t.id}>
                        <td><input type="checkbox" name="txn" value={t.id} defaultChecked={!!t.suggestedUnitId} className="h-4 w-4 accent-brand-600" /></td>
                        <td className="whitespace-nowrap">{date(t.date)}</td>
                        <td><div className="font-medium">{t.counterparty ?? "—"}</div><div className="text-xs text-slate-500">{t.reason}</div></td>
                        <td className="text-right font-medium text-green-700">{money(t.amount)}</td>
                        <td>
                          <select name={`unit_${t.id}`} defaultValue={t.suggestedUnitId ?? ""} className="input w-40 text-xs">
                            <option value="">— изберете —</option>
                            {units.map((u) => <option key={u.id} value={u.id}>{u.number} {u.ownerName ? `· ${u.ownerName}` : ""}</option>)}
                          </select>
                          {t.confidence && <Badge className={t.confidence === "HIGH" ? "mt-1 bg-green-500/15 text-green-700" : "mt-1 bg-amber-500/15 text-amber-700"}>{t.confidence === "HIGH" ? "по номер" : "по име"}</Badge>}
                        </td>
                        <td><button formAction={ignoreTxn.bind(null, t.id)} className="btn-secondary btn-sm" title="Игнорирай">✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <SubmitButton>Импортирай отметнатите като плащания</SubmitButton>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}
