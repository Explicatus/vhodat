"use server";
import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { cents, optStr, str } from "@/lib/util";

export async function createExpense(form: FormData) {
  const { building, user } = await requireManager();
  const amountCents = cents(form, "amount");
  const description = str(form, "description");
  if (amountCents <= 0 || !description) return;
  const d = str(form, "date");
  await db.expense.create({
    data: { buildingId: building.id, amountCents, description, category: str(form, "category") || "OTHER", vendor: optStr(form, "vendor"), date: d ? new Date(d) : new Date() },
  });
  await audit(building.id, user, "expense.create", description, amountCents);
  revalidatePath("/expenses");
}

export async function deleteExpense(id: string) {
  const { building, user } = await requireManager();
  const e = await db.expense.findFirst({ where: { id, buildingId: building.id } });
  if (!e) return;
  await db.expense.delete({ where: { id } });
  await audit(building.id, user, "expense.delete", `Изтрит разход „${e.description}“ от ${e.date.toLocaleDateString("bg-BG")}`, e.amountCents);
  revalidatePath("/expenses");
}
