import Link from "next/link";
import { requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildingCash, unitBalances } from "@/lib/finance";
import { date, money } from "@/lib/format";
import { Card, Empty, PageHeader, Stat } from "@/components/ui";

export default async function Dashboard() {
  const { building, isManager, membership, user } = await requireMembership();
  const [cash, balances, announcements, polls, openIssues] = await Promise.all([
    buildingCash(building.id),
    unitBalances(building.id),
    db.announcement.findMany({ where: { buildingId: building.id }, orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take: 3 }),
    db.poll.findMany({ where: { buildingId: building.id, closesAt: { gt: new Date() } }, orderBy: { closesAt: "asc" }, take: 3 }),
    db.issue.count({ where: { buildingId: building.id, status: { not: "RESOLVED" } } }),
  ]);
  const debtors = balances.filter((b) => b.balance > 0).sort((a, b) => b.balance - a.balance);
  const totalDebt = debtors.reduce((s, d) => s + d.balance, 0);
  const mine = membership.unitId ? balances.find((b) => b.unit.id === membership.unitId) : undefined;

  return (
    <>
      <PageHeader title={building.name} subtitle={`${building.address}, ${building.city}`} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {!isManager && (
          <Stat
            label="Моето салдо"
            value={mine ? money(Math.abs(mine.balance)) : "—"}
            hint={!mine ? "Нямате свързан обект" : mine.balance > 0 ? "Дължима сума" : mine.balance < 0 ? "Надплатено" : "Нямате задължения"}
            tone={mine && mine.balance > 0 ? "bad" : "good"}
            action={mine && mine.balance > 0 ? <Link href="/finance" className="btn-primary btn-sm mt-2">💳 Плати онлайн</Link> : undefined}
          />
        )}
        <Stat label="Наличност в касата" value={money(cash.cash)} hint={`Приходи ${money(cash.income)} · Разходи ${money(cash.expenses)}`} tone={cash.cash >= 0 ? "good" : "bad"} />
        {isManager && <Stat label="Общо задължения" value={money(totalDebt)} hint={`${debtors.length} обекта с дълг`} tone={totalDebt > 0 ? "bad" : "good"} />}
        <Stat label="Обекти" value={String(balances.length)} />
        <Stat label="Отворени сигнали" value={String(openIssues)} tone={openIssues ? "bad" : "good"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="📢 Последни обяви" action={<Link href="/announcements" className="text-sm text-brand-600">Всички →</Link>}>
          {announcements.length === 0 ? <Empty>Няма обяви.</Empty> : (
            <ul className="space-y-3">
              {announcements.map((a) => (
                <li key={a.id} className="border-b border-slate-500/10 pb-3 last:border-0">
                  <div className="font-medium">{a.pinned && "📌 "}{a.title}</div>
                  <div className="line-clamp-2 text-sm text-slate-600">{a.body}</div>
                  <div className="mt-1 text-xs text-slate-400">{date(a.createdAt)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="🗳️ Активни гласувания" action={<Link href="/polls" className="text-sm text-brand-600">Всички →</Link>}>
          {polls.length === 0 ? <Empty>Няма активни гласувания.</Empty> : (
            <ul className="space-y-2">
              {polls.map((p) => (
                <li key={p.id}>
                  <Link href={`/polls/${p.id}`} className="block rounded-2xl border border-white/50 bg-white/30 p-3 transition hover:bg-white/50 dark:bg-white/5">
                    <div className="font-medium">{p.question}</div>
                    <div className="text-xs text-slate-500">Краен срок: {date(p.closesAt)}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {isManager && (
          <Card title="⚠️ Длъжници" action={<Link href="/finance" className="text-sm text-brand-600">Плащания →</Link>} className="lg:col-span-2">
            {debtors.length === 0 ? <Empty>Няма длъжници 🎉</Empty> : (
              <table className="table">
                <thead><tr><th>Обект</th><th>Собственик</th><th className="text-right">Дълг</th></tr></thead>
                <tbody>
                  {debtors.slice(0, 8).map((d) => (
                    <tr key={d.unit.id}>
                      <td><Link href={`/units/${d.unit.id}`} className="text-brand-600 hover:underline">{d.unit.number}</Link></td>
                      <td>{d.unit.ownerName ?? "—"}</td>
                      <td className="text-right font-medium text-red-600">{money(d.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}
        {!isManager && !membership.unitId && (
          <Card title="Свържете обект" className="lg:col-span-2">
            <p className="text-sm text-slate-600">Здравейте, {user.name}! Помолете домоуправителя да свърже профила ви с вашия апартамент, за да виждате задълженията си и да гласувате.</p>
          </Card>
        )}
      </div>
    </>
  );
}
