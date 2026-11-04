"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, setCurrentBuilding } from "@/lib/auth";
import { str } from "@/lib/util";

export async function switchBuilding(form: FormData) {
  const user = await requireUser();
  const buildingId = str(form, "buildingId");
  const m = await db.membership.findUnique({ where: { userId_buildingId: { userId: user.id, buildingId } } });
  if (m) await setCurrentBuilding(buildingId);
  redirect("/dashboard");
}
