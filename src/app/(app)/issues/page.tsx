import { requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime, ISSUE_STATUS } from "@/lib/format";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { createIssue, setIssueStatus } from "./actions";

export default async function Issues() {
  const { building, isManager } = await requireMembership();
  const issues = await db.issue.findMany({ where: { buildingId: building.id }, include: { author: true }, orderBy: [{ status: "asc" }, { createdAt: "desc" }] });
  const order = { OPEN: 0, IN_PROGRESS: 1, RESOLVED: 2 } as Record<string, number>;
  issues.sort((a, b) => order[a.status] - order[b.status] || +b.createdAt - +a.createdAt);
  return (
    <>
      <PageHeader title="Сигнали" subtitle="Повреди и проблеми в общите части" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {issues.length === 0 ? <Empty>Няма подадени сигнали.</Empty> : issues.map((i) => {
            const st = ISSUE_STATUS[i.status];
            return (
              <div key={i.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{i.title}</h3>
                    {i.location && <div className="text-xs text-slate-500">📍 {i.location}</div>}
                  </div>
                  <Badge className={st.cls}>{st.label}</Badge>
                </div>
                {i.description && <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{i.description}</p>}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-slate-400">{i.author.name} · {dateTime(i.createdAt)}</span>
                  {isManager && (
                    <div className="flex gap-1">
                      {Object.entries(ISSUE_STATUS).filter(([k]) => k !== i.status).map(([k, v]) => (
                        <form key={k} action={setIssueStatus.bind(null, i.id, k)}><SubmitButton className="btn-secondary btn-sm">→ {v.label}</SubmitButton></form>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <Card title="🛠️ Подай сигнал">
          <form action={createIssue} className="space-y-3">
            <label className="block"><span className="label">Какъв е проблемът?</span><input name="title" required placeholder="Изгоряла лампа" className="input" /></label>
            <label className="block"><span className="label">Къде?</span><input name="location" placeholder="Стълбище, 4 етаж" className="input" /></label>
            <label className="block"><span className="label">Подробности</span><textarea name="description" rows={4} className="input" /></label>
            <SubmitButton className="btn-primary w-full">Изпрати</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
