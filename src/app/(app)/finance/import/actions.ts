"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { decode, matchUnit, parseStatement } from "@/lib/bank";
import { notify } from "@/lib/notify";
import { money } from "@/lib/format";
import { isPro } from "@/lib/billing";

export async function uploadStatement(form: FormData) {
  const { building } = await requireManager();
  if (!isPro(building)) redirect("/billing");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) redirect("/finance/import?err=" + encodeURIComponent("Изберете файл."));
  if (file.size > 5_000_000) redirect("/finance/import?err=" + encodeURIComponent("Файлът е над 5 MB."));
  let txns;
  try { txns = parseStatement(decode(await file.arrayBuffer())); }
  catch (e) { redirect("/finance/import?err=" + encodeURIComponent((e as Error).message)); }
  const units = await db.unit.findMany({ where: { buildingId: building.id }, select: { id: true, number: true, ownerName: true } });
  let added = 0;
  for (const t of txns) {
    const exists = await db.bankTxn.findUnique({ where: { buildingId_hash: { buildingId: building.id, hash: t.hash } } });
    if (exists) continue;
    const m = matchUnit(t, units);
    const { amount, ...rest } = t;
    await db.bankTxn.create({ data: { buildingId: building.id, ...rest, amountCents: Math.round(amount * 100), suggestedUnitId: m?.unitId, confidence: m?.confidence } });
    added++;
  }
  redirect(`/finance/import?added=${added}&total=${txns.length}`);
}

/** Импортира отметнатите редове като плащания. */
export async function confirmTxns(form: FormData) {
  const { building } = await requireManager();
  const ids = form.getAll("txn").map(String);
  let n = 0;
  for (const id of ids) {
    const unitId = String(form.get(`unit_${id}`) || "");
    const t = await db.bankTxn.findFirst({ where: { id, buildingId: building.id, status: "NEW" } });
    const unit = unitId ? await db.unit.findFirst({ where: { id: unitId, buildingId: building.id } }) : null;
    if (!t || !unit) continue;
    const p = await db.payment.create({ data: { unitId: unit.id, amountCents: t.amountCents, method: "BANK", paidAt: t.date, note: t.reason.slice(0, 120) || "Банков превод" } });
    await db.bankTxn.update({ where: { id }, data: { status: "IMPORTED", paymentId: p.id } });
    await notify({ buildingId: building.id, unitIds: [unit.id] }, { title: "Получено плащане", body: `Банков превод от ${money(t.amountCents)} за обект ${unit.number} е отразен.`, link: "/finance" });
    n++;
  }
  revalidatePath("/finance");
  redirect(`/finance/import?imported=${n}`);
}

export async function ignoreTxn(id: string) {
  const { building } = await requireManager();
  await db.bankTxn.updateMany({ where: { id, buildingId: building.id }, data: { status: "IGNORED" } });
  revalidatePath("/finance/import");
}
