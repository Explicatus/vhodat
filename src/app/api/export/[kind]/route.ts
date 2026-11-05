import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { unitBalances } from "@/lib/finance";
import { AUDIT_ACTIONS } from "@/lib/audit";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from "@/lib/format";

/** Центове → „12,50“ (формат за Excel на български). */
const eur = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const csv = (rows: (string | number | null)[][]) =>
  "﻿" + rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");

export async function GET(_: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const wanted = (await cookies()).get("es_building")?.value;
  const memberships = await db.membership.findMany({ where: { userId: user.id, role: "MANAGER" } });
  const m = memberships.find((x) => x.buildingId === wanted) ?? memberships[0];
  if (!m) return new NextResponse("Forbidden", { status: 403 });

  let body = "";
  if (kind === "balances") {
    const rows = await unitBalances(m.buildingId);
    body = csv([["Обект", "Собственик", "Живущи", "Месечна такса", "Начислено", "Платено", "Салдо"],
      ...rows.map((r) => [r.unit.number, r.unit.ownerName, r.unit.residents, eur(r.unit.monthlyFeeCents), eur(r.charged), eur(r.paid), eur(r.balance)])]);
  } else if (kind === "payments") {
    const rows = await db.payment.findMany({ where: { unit: { buildingId: m.buildingId } }, include: { unit: true }, orderBy: { paidAt: "asc" } });
    body = csv([["Дата", "Обект", "Сума", "Начин", "Бележка"],
      ...rows.map((p) => [p.paidAt.toISOString().slice(0, 10), p.unit.number, eur(p.amountCents), PAYMENT_METHODS[p.method], p.note])]);
  } else if (kind === "expenses") {
    const rows = await db.expense.findMany({ where: { buildingId: m.buildingId }, orderBy: { date: "asc" } });
    body = csv([["Дата", "Категория", "Описание", "Доставчик", "Сума"],
      ...rows.map((e) => [e.date.toISOString().slice(0, 10), EXPENSE_CATEGORIES[e.category] ?? e.category, e.description, e.vendor, eur(e.amountCents)])]);
  } else if (kind === "audit") {
    const rows = await db.auditLog.findMany({ where: { buildingId: m.buildingId }, orderBy: { createdAt: "asc" } });
    body = csv([["Дата и час", "Потребител", "Действие", "Подробности", "Сума"],
      ...rows.map((a) => [a.createdAt.toISOString().replace("T", " ").slice(0, 19), a.userName, AUDIT_ACTIONS[a.action] ?? a.action, a.summary, a.amountCents != null ? eur(a.amountCents) : ""])]);
  } else return new NextResponse("Not found", { status: 404 });

  return new NextResponse(body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${kind}.csv"` },
  });
}
