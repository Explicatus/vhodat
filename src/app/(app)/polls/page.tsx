import Link from "next/link";
import { requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import { date } from "@/lib/format";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { createPoll } from "./actions";

export default async function Polls() {
  const { building, isManager } = await requireMembership();
  const [polls, unitCount] = await Promise.all([
    db.poll.findMany({ where: { buildingId: building.id }, include: { _count: { select: { votes: true } } }, orderBy: { createdAt: "desc" } }),
    db.unit.count({ where: { buildingId: building.id } }),
  ]);
  const now = new Date();
  const inWeek = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  return (
    <>
      <PageHeader title="Гласувания" subtitle="Решения на етажната собственост — един глас на обект, с тежест по идеални части" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {polls.length === 0 ? <Empty>Няма гласувания.</Empty> : polls.map((p) => {
            const open = p.closesAt > now;
            return (
              <Link key={p.id} href={`/polls/${p.id}`} className="card block hover:border-brand-500">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold">{p.question}</h3>
                  <Badge className={open ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}>{open ? "Активно" : "Приключило"}</Badge>
                </div>
                <div className="mt-1 text-xs text-slate-500">Срок: {date(p.closesAt)} · Гласували {p._count.votes} от {unitCount} обекта</div>
              </Link>
            );
          })}
        </div>
        {isManager && (
          <Card title="🗳️ Ново гласуване">
            <form action={createPoll} className="space-y-3">
              <label className="block"><span className="label">Въпрос</span><input name="question" required className="input" placeholder="Да сменим ли входната врата?" /></label>
              <label className="block"><span className="label">Описание</span><textarea name="description" rows={3} className="input" /></label>
              <label className="block"><span className="label">Опции (по една на ред)</span><textarea name="options" rows={3} className="input" placeholder={"За\nПротив\nВъздържал се"} /></label>
              <label className="block"><span className="label">Краен срок</span><input name="closesAt" type="date" defaultValue={inWeek} required className="input" /></label>
              <SubmitButton className="btn-primary w-full">Създай</SubmitButton>
            </form>
          </Card>
        )}
      </div>
    </>
  );
}
