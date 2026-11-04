import { requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { Card, Empty, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { createAnnouncement, deleteAnnouncement, togglePin } from "./actions";

export default async function Announcements() {
  const { building, isManager } = await requireMembership();
  const items = await db.announcement.findMany({ where: { buildingId: building.id }, include: { author: true }, orderBy: [{ pinned: "desc" }, { createdAt: "desc" }] });
  return (
    <>
      <PageHeader title="Обяви" subtitle="Новини и съобщения за всички живущи" />
      {isManager && (
        <Card title="Нова обява" className="mb-6">
          <form action={createAnnouncement} className="space-y-3">
            <input name="title" required placeholder="Заглавие" className="input" />
            <textarea name="body" required rows={4} placeholder="Текст на обявата…" className="input" />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="pinned" /> Закачи най-горе</label>
              <SubmitButton>Публикувай</SubmitButton>
            </div>
          </form>
        </Card>
      )}
      {items.length === 0 ? <Empty>Няма обяви.</Empty> : (
        <div className="space-y-4">
          {items.map((a) => (
            <article key={a.id} className={`card ${a.pinned ? "border-brand-500 ring-1 ring-brand-100" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold">{a.pinned && "📌 "}{a.title}</h2>
                {isManager && (
                  <div className="flex shrink-0 gap-1">
                    <form action={togglePin.bind(null, a.id)}><SubmitButton className="btn-secondary btn-sm">{a.pinned ? "Откачи" : "Закачи"}</SubmitButton></form>
                    <form action={deleteAnnouncement.bind(null, a.id)}><SubmitButton className="btn-secondary btn-sm" confirm="Изтриване на обявата?">✕</SubmitButton></form>
                  </div>
                )}
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{a.body}</p>
              <div className="mt-3 text-xs text-slate-400">{a.author.name} · {dateTime(a.createdAt)}</div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
