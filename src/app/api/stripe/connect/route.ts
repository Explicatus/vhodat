import { NextResponse } from "next/server";
import { requireManager } from "@/lib/auth";
import { db } from "@/lib/db";
import { appUrl, stripe } from "@/lib/payments";

/** Връщане от Stripe onboarding — обновява статуса на сметката. */
export async function GET() {
  const { building } = await requireManager();
  const base = await appUrl();
  if (building.stripeAccountId) {
    try {
      const a = await stripe().accounts.retrieve(building.stripeAccountId);
      await db.building.update({ where: { id: building.id }, data: { stripeChargesEnabled: !!a.charges_enabled } });
    } catch { /* ще се обнови от webhook */ }
  }
  return NextResponse.redirect(`${base}/settings?stripe=return`);
}
