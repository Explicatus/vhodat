"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { num, optStr, str } from "@/lib/util";

export async function createExpense(form: FormData) {
  const { building } = await requireManager();
  const amount = num(form, "amount");
  const description = str(form, "description");
  if (amount <= 0 || !description) return;
  const d = str(form, "date");
  await db.expense.create({
    data: { buildingId: building.id, amount, description, category: str(form, "category") || "OTHER", vendor: optStr(form, "vendor"), date: d ? new Date(d) : new Date() },
  });
  revalidatePath("/expenses");
}

export async function deleteExpense(id: string) {
  const { building } = await requireManager();
  await db.expense.deleteMany({ where: { id, buildingId: building.id } });
  revalidatePath("/expenses");
}
