import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { db } from "@/lib/db";
import { AUDIT_ACTIONS } from "@/lib/audit";
import { dateTime, money } from "@/lib/format";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";

const GROUPS: Record<string, { label: string; prefixes: string[] }> = {
  money: { label: "💶 Пари", prefixes: ["payment.", "charge.", "expense.", "unit.fees", "reminder."] },
  units: { label: "🚪 Обекти", prefixes: ["unit."] },
  members: { label: "👥 Членове", prefixes: ["member.", "building."] },
  other: { label: "🗳️ Други", prefixes: ["poll.", "announcement.", "issue.", "billing.", "system."] },
};
const tone = (a: string) =>
  a.endsWith(".delete") || a === "charge.reverse" || a === "member.remove" ? "bg-red-500/15 text-red-600"
  : a.startsWith("payment.") ? "bg-green-500/15 text-green-700"
  : "bg-slate-500/15 text-slate-700";

export default async function History({ searchParams }: { searchParams: Promise<{ g?: string }> }) {
  const { g } = await searchParams;
  const { building } = await requireManager();
  const group = g && GROUPS[g] ? GROUPS[g] : null;
  const items = await db.auditLog.findMany({
    where: { buildingId: building.id, ...(group ? { OR: group.prefixes.map((p) => ({ action: { startsWith: p } })) } : {}) },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  return (
    <>
      <PageHeader title="История на промените" subtitle="Всяко действие с пари, обекти и права — кой, какво и кога. Записите не могат да се редактират или изтриват."
        action={<a href="/api/export/audit" className="btn-secondary">⬇ CSV</a>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/history" className={!group ? "nav-pill nav-pill-active" : "nav-pill"}>Всички</Link>
        {Object.entries(GROUPS).map(([k, v]) => <Link key={k} href={`/history?g=${k}`} className={g === k ? "nav-pill nav-pill-active" : "nav-pill"}>{v.label}</Link>)}
      </div>
      <Card>
        {items.length === 0 ? <Empty>Още няма записи.</Empty> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Кога</th><th>Кой</th><th>Действие</th><th>Подробности</th><th className="text-right">Сума</th></tr></thead>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap text-xs">{dateTime(a.createdAt)}</td>
                    <td className="whitespace-nowrap">{a.userName}</td>
                    <td><Badge className={tone(a.action)}>{AUDIT_ACTIONS[a.action] ?? a.action}</Badge></td>
                    <td className="text-sm">{a.summary}</td>
                    <td className="whitespace-nowrap text-right">{a.amountCents != null ? money(a.amountCents) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
