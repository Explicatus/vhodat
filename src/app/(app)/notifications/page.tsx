import { requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { Empty, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { markAllRead, openNotification } from "./actions";

export default async function Notifications() {
  const { user } = await requireMembership();
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <>
      <PageHeader title="Известия" subtitle={unread ? `${unread} непрочетени` : "Всичко е прочетено"}
        action={unread ? <form action={markAllRead}><SubmitButton className="btn-secondary">Маркирай всички като прочетени</SubmitButton></form> : undefined} />
      {items.length === 0 ? <Empty>Нямате известия.</Empty> : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id}>
              <form action={openNotification.bind(null, n.id)}>
                <button className={`card w-full text-left transition hover:scale-[1.005] ${n.readAt ? "opacity-70" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-semibold">{!n.readAt && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-brand-500 align-middle" />}{n.title}</div>
                    <div className="shrink-0 text-xs text-slate-400">{dateTime(n.createdAt)}</div>
                  </div>
                  <div className="mt-1 text-sm text-slate-600">{n.body}</div>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
