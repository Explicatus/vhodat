import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime, UNIT_KINDS } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";

/** Книга на етажната собственост (чл. 7 ЗУЕС) — за печат или PDF. */
export default async function Register() {
  const { building } = await requireManager();
  const units = await db.unit.findMany({
    where: { buildingId: building.id },
    include: { memberUnits: { include: { membership: { include: { user: true } } } } },
    orderBy: [{ entrance: "asc" }, { floor: "asc" }, { number: "asc" }],
  });
  const fmt = (n: number | null) => (n == null ? "" : n.toFixed(2).replace(".", ","));
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex justify-between print:hidden">
        <Link href="/units" className="btn-secondary">← Обекти</Link>
        <PrintButton label="🖨 Печат / PDF" />
      </div>
      <article className="doc">
        <header className="text-center">
          <h1 className="text-xl font-bold uppercase">Книга на етажната собственост</h1>
          <div>{building.name} · {building.address}, {building.city}{building.bulstat ? ` · БУЛСТАТ ${building.bulstat}` : ""}</div>
          <div className="text-xs text-slate-500">по чл. 7 от Закона за управление на етажната собственост · към {dateTime(new Date())}</div>
        </header>
        <table className="mt-6">
          <thead><tr><th>№</th><th>Вид</th><th>Вход/ет.</th><th>Площ м²</th><th>Ид. ч. %</th><th>Собственик</th><th>Обитатели / потребители</th><th>Живущи</th></tr></thead>
          <tbody>
            {units.map((u) => (
              <tr key={u.id}>
                <td>{u.number}</td><td>{UNIT_KINDS[u.kind] ?? u.kind}</td><td>{u.entrance ?? ""}{u.floor != null ? ` / ${u.floor}` : ""}</td>
                <td>{fmt(u.area)}</td><td>{fmt(u.idealParts)}</td>
                <td>{u.ownerName ?? ""}{u.ownerEmail && <div className="text-xs">{u.ownerEmail}</div>}</td>
                <td className="text-xs">{u.memberUnits.map((mu) => `${mu.membership.user.name}${mu.membership.user.phone ? `, ${mu.membership.user.phone}` : ""}`).join("; ")}</td>
                <td>{u.residents}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={4}><b>Общо {units.length} обекта</b></td><td><b>{fmt(units.reduce((s, u) => s + u.idealParts, 0))}</b></td><td colSpan={2} /><td><b>{units.reduce((s, u) => s + u.residents, 0)}</b></td></tr></tfoot>
        </table>
      </article>
    </div>
  );
}
