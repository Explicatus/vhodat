"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/auth";
import { createStripeCheckout, feeFor, markOnlinePaid, MAX_ONLINE, MIN_ONLINE, mockMode, onlineEnabled } from "@/lib/payments";
import { cents } from "@/lib/util";

/** Собственик стартира плащане с карта за своя обект. */
export async function startCardPayment(form: FormData) {
  const { user, building, membership } = await requireMembership();
  if (!membership.unitId) redirect("/finance");
  if (!onlineEnabled(building)) redirect("/finance?pay=disabled");
  const amountCents = cents(form, "amount");
  if (amountCents < MIN_ONLINE || amountCents > MAX_ONLINE) redirect("/finance?pay=amount");
  const unit = await db.unit.findFirst({ where: { id: membership.unitId, buildingId: building.id } });
  if (!unit) redirect("/finance");

  const mock = mockMode();
  const op = await db.onlinePayment.create({
    data: { buildingId: building.id, unitId: unit.id, userId: user.id, amountCents, platformFeeCents: feeFor(amountCents), provider: mock ? "mock" : "stripe" },
  });
  if (mock) redirect(`/pay/mock/${op.id}`);

  const url = await createStripeCheckout({
    onlinePaymentId: op.id, amountCents, feeCents: op.platformFeeCents, destination: building.stripeAccountId!,
    buildingName: building.name, unitNumber: unit.number, email: user.email,
  });
  redirect(url);
}

/** Само в тестов режим: симулира успешно / отказано плащане. */
export async function completeMockPayment(id: string, success: boolean) {
  const { user } = await requireMembership();
  if (!mockMode()) redirect("/finance");
  const op = await db.onlinePayment.findFirst({ where: { id, userId: user.id, provider: "mock" } });
  if (!op) redirect("/finance");
  if (success) await markOnlinePaid(op.id, `mock_${op.id}`);
  else if (op.status === "PENDING") await db.onlinePayment.update({ where: { id }, data: { status: "CANCELED" } });
  redirect(`/pay/result?op=${id}${success ? "" : "&canceled=1"}`);
}
