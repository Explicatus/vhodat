import { requireManager } from "@/lib/auth";
import { db } from "@/lib/db";
import { FREE_UNIT_LIMIT, isPro, PRO_PRICE_PER_UNIT } from "@/lib/billing";
import { mockMode } from "@/lib/payments";
import { date, money } from "@/lib/format";
import { Card, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { manage, upgrade } from "./actions";

export default async function Billing({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { building } = await requireManager();
  const units = await db.unit.count({ where: { buildingId: building.id } });
  const pro = isPro(building);
  const monthly = Math.max(1, units) * PRO_PRICE_PER_UNIT;
  const used = Math.min(100, (units / FREE_UNIT_LIMIT) * 100);
  return (
    <>
      <PageHeader title="Абонамент" subtitle={building.name} />
      {sp.limit && <div className="mb-4 rounded-xl bg-amber-500/15 p-3 text-sm text-amber-800">Достигнахте лимита от {FREE_UNIT_LIMIT} обекта на безплатния план. Преминете към „Професионален“, за да добавите още.</div>}
      {sp.success && <div className="mb-4 rounded-xl bg-green-500/15 p-3 text-sm text-green-800">🎉 Абонаментът „Професионален“ е активен. Благодарим!</div>}
      {sp.canceled && <div className="mb-4 rounded-xl bg-slate-500/15 p-3 text-sm">Абонаментът е прекратен. Върнахте се на безплатния план.</div>}
      {mockMode() && <div className="mb-4 rounded-xl bg-amber-500/15 p-3 text-xs text-amber-800">🧪 Тестов режим — абонаментът се активира без реално плащане.</div>}

      <div className="grid gap-6 md:grid-cols-2">
        <Card className={!pro ? "ring-2 ring-brand-500/60" : ""}>
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Вход</h2>{!pro && <span className="badge bg-brand-500/15 text-brand-700">Текущ план</span>}</div>
          <div className="mt-2 text-3xl font-bold">0 €</div>
          <ul className="mt-4 space-y-1 text-sm text-slate-600">
            <li>✓ До {FREE_UNIT_LIMIT} обекта</li><li>✓ Такси, разходи, обяви, гласувания, сигнали</li><li>✓ Онлайн плащане с карта</li><li>✓ Известия в приложението и по имейл</li>
          </ul>
          {!pro && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-500"><span>Използвани обекти</span><span>{units} / {FREE_UNIT_LIMIT}</span></div>
              <div className="mt-1 h-2 rounded-full bg-slate-500/15"><div className={`h-2 rounded-full ${used >= 100 ? "bg-red-500" : "bg-brand-500"}`} style={{ width: `${used}%` }} /></div>
            </div>
          )}
        </Card>
        <Card className={pro ? "ring-2 ring-brand-500/60" : ""}>
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Професионален</h2>{pro && <span className="badge bg-green-500/15 text-green-700">Активен</span>}</div>
          <div className="mt-2 text-3xl font-bold">{money(PRO_PRICE_PER_UNIT)} <span className="text-base font-normal text-slate-500">/ обект / месец</span></div>
          <ul className="mt-4 space-y-1 text-sm text-slate-600">
            <li>✓ Неограничен брой обекти и сгради</li><li>✓ Импорт на банкови извлечения</li><li>✓ SMS и Viber известия</li><li>✓ Протоколи и Книга на ЕС</li><li>✓ Приоритетна поддръжка</li>
          </ul>
          <p className="mt-4 text-sm">За вашите {units} обекта: <b>{money(monthly)} / месец</b></p>
          {pro && building.currentPeriodEnd && <p className="text-xs text-slate-500">Следващо плащане: {date(building.currentPeriodEnd)}</p>}
          <div className="mt-4">
            {pro
              ? <form action={manage}><SubmitButton className="btn-secondary" confirm={mockMode() ? "Прекратяване на абонамента (тестов режим)?" : undefined}>{mockMode() ? "Прекрати абонамента" : "Управление, фактури и карта →"}</SubmitButton></form>
              : <form action={upgrade}><SubmitButton>Премини към Професионален</SubmitButton></form>}
          </div>
        </Card>
      </div>
      <p className="mt-6 text-xs text-slate-500">Цените са без ДДС. Таксуването е месечно спрямо броя обекти; при добавяне или премахване на обекти сумата се преизчислява пропорционално. Фактури се издават автоматично от Stripe.</p>
    </>
  );
}
