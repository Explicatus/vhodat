import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { Badge, Card, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { closePoll, deletePoll, vote } from "../actions";

export default async function PollPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { building, isManager, units: myUnits, unitIds } = await requireMembership();
  const poll = await db.poll.findFirst({
    where: { id, buildingId: building.id },
    include: { options: { orderBy: { order: "asc" } }, votes: { include: { unit: true, user: true } } },
  });
  if (!poll) notFound();
  const units = await db.unit.findMany({ where: { buildingId: building.id }, select: { idealParts: true } });
  const totalIdeal = units.reduce((s, u) => s + u.idealParts, 0);
  const open = poll.closesAt > new Date();
  const myVotes = poll.votes.filter((v) => unitIds.includes(v.unitId));
  const myVote = myVotes[0];
  const label = (optionId: string) => poll.options.find((o) => o.id === optionId)?.label;
  const turnoutIdeal = poll.votes.reduce((s, v) => s + v.unit.idealParts, 0);

  const results = poll.options.map((o) => {
    const vs = poll.votes.filter((v) => v.optionId === o.id);
    const ideal = vs.reduce((s, v) => s + v.unit.idealParts, 0);
    return { o, count: vs.length, ideal, pct: totalIdeal ? (ideal / totalIdeal) * 100 : poll.votes.length ? (vs.length / poll.votes.length) * 100 : 0 };
  });

  return (
    <>
      <PageHeader title={poll.question} subtitle={`Краен срок: ${dateTime(poll.closesAt)}`} action={<Link href="/polls" className="btn-secondary">← Гласувания</Link>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {poll.description && <Card><p className="whitespace-pre-line text-sm">{poll.description}</p></Card>}
          <Card title="Резултати" action={<Badge className={open ? "bg-green-500/15 text-green-700" : "bg-slate-500/15 text-slate-600"}>{open ? "Активно" : "Приключило"}</Badge>}>
            <ul className="space-y-4">
              {results.map((r) => (
                <li key={r.o.id}>
                  <div className="flex justify-between text-sm"><span className="font-medium">{r.o.label}</span><span>{r.count} гл. · {r.pct.toFixed(1)}% ид.ч.</span></div>
                  <div className="mt-1 h-3 rounded-full bg-slate-500/15"><div className="h-3 rounded-full bg-brand-500" style={{ width: `${Math.min(100, r.pct)}%` }} /></div>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-slate-500">
              Участие: {poll.votes.length} от {units.length} обекта{totalIdeal ? ` · ${((turnoutIdeal / totalIdeal) * 100).toFixed(1)}% от идеалните части` : ""}.
              Процентите са спрямо всички идеални части в сградата.
            </p>
          </Card>
          {isManager && (
            <Card title="Кой как гласува">
              <table className="table"><tbody>
                {poll.votes.map((v) => (
                  <tr key={v.id}><td>Обект {v.unit.number}</td><td>{v.user.name}</td><td>{poll.options.find((o) => o.id === v.optionId)?.label}</td><td className="text-right text-xs text-slate-400">{dateTime(v.createdAt)}</td></tr>
                ))}
                {poll.votes.length === 0 && <tr><td className="text-slate-400">Още няма гласове</td></tr>}
              </tbody></table>
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <Card title="Вашият глас">
            {myUnits.length === 0 ? <p className="text-sm text-slate-500">За да гласувате, профилът ви трябва да е свързан с обект.</p>
              : !open ? (
                <div className="text-sm text-slate-500">Гласуването е приключило.
                  {myVotes.map((v) => <div key={v.id}>Обект {myUnits.find((u) => u.id === v.unitId)?.number}: <b>{label(v.optionId)}</b></div>)}
                </div>
              ) : (
                <form action={vote.bind(null, poll.id)} className="space-y-2">
                  {poll.options.map((o) => (
                    <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/40 p-3 text-sm hover:bg-white/25">
                      <input type="radio" name="optionId" value={o.id} defaultChecked={myVote?.optionId === o.id} required /> {o.label}
                    </label>
                  ))}
                  {myUnits.length > 1 ? (
                    <fieldset className="rounded-xl border border-white/40 p-3 text-sm">
                      <legend className="px-1 text-xs text-slate-500">Гласувам за обекти</legend>
                      {myUnits.map((u) => {
                        const v = myVotes.find((x) => x.unitId === u.id);
                        return (
                          <label key={u.id} className="flex items-center gap-2 py-0.5">
                            <input type="checkbox" name="unitId" value={u.id} defaultChecked className="accent-brand-600" />
                            Обект {u.number} <span className="text-xs text-slate-400">({u.idealParts}% ид.ч.{v ? ` · сега: ${label(v.optionId)}` : ""})</span>
                          </label>
                        );
                      })}
                    </fieldset>
                  ) : <input type="hidden" name="unitId" value={myUnits[0].id} />}
                  <SubmitButton className="btn-primary w-full">{myVote ? "Промени гласа" : "Гласувай"}</SubmitButton>
                </form>
              )}
          </Card>
          {isManager && (
            <Card title="Управление">
              <div className="flex flex-wrap gap-2">
                <Link href={`/polls/${poll.id}/protocol`} className="btn-secondary btn-sm">📄 Протокол (PDF)</Link>
                {open && <form action={closePoll.bind(null, poll.id)}><SubmitButton className="btn-secondary btn-sm" confirm="Приключване на гласуването сега?">Приключи</SubmitButton></form>}
                <form action={deletePoll.bind(null, poll.id)}><SubmitButton className="btn-danger btn-sm" confirm="Изтриване на гласуването?">Изтрий</SubmitButton></form>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
