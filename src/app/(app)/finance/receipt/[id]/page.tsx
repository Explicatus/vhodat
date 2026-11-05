import { notFound } from "next/navigation";
import { requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import { date, money, PAYMENT_METHODS } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";

export default async function Receipt({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { building, isManager, unitIds } = await requireMembership();
  const p = await db.payment.findFirst({ where: { id, unit: { buildingId: building.id } }, include: { unit: true } });
  if (!p || (!isManager && !unitIds.includes(p.unitId))) notFound();
  return (
    <div className="mx-auto max-w-lg">
      <div className="card space-y-4 print:border-0 print:shadow-none">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">Разписка</h1>
            <div className="text-xs text-slate-500">№ {p.id.slice(-8).toUpperCase()}</div>
          </div>
          <div className="text-right text-sm">
            <div className="font-semibold">{building.name}</div>
            <div className="text-slate-500">{building.address}, {building.city}</div>
            {building.bulstat && <div className="text-slate-500">БУЛСТАТ {building.bulstat}</div>}
          </div>
        </div>
        <table className="table">
          <tbody>
            <tr><td>Дата</td><td className="text-right">{date(p.paidAt)}</td></tr>
            <tr><td>Обект</td><td className="text-right">{p.unit.number}</td></tr>
            <tr><td>Платец</td><td className="text-right">{p.unit.ownerName ?? "—"}</td></tr>
            <tr><td>Начин на плащане</td><td className="text-right">{PAYMENT_METHODS[p.method]}</td></tr>
            {p.note && <tr><td>Основание</td><td className="text-right">{p.note}</td></tr>}
            <tr className="text-lg font-bold"><td>Сума</td><td className="text-right">{money(p.amountCents)}</td></tr>
          </tbody>
        </table>
        <div className="flex justify-between pt-8 text-xs text-slate-500"><span>Получил: ................</span><span>Платил: ................</span></div>
      </div>
      <div className="mt-4 text-center print:hidden"><PrintButton /></div>
    </div>
  );
}
