import "server-only";
import { db } from "./db";
import { appUrl, mockMode, stripe } from "./payments";

export const FREE_UNIT_LIMIT = 10;
export const PRO_PRICE_PER_UNIT = 0.5;

type B = { id: string; plan: string; subscriptionStatus: string | null };
export const isPro = (b: B) => b.plan === "PRO" && ["active", "trialing", "past_due"].includes(b.subscriptionStatus ?? "");
export const unitLimit = (b: B) => (isPro(b) ? Infinity : FREE_UNIT_LIMIT);

/** Колко нови обекта може да се добавят още. */
export async function remainingUnits(b: B) {
  if (isPro(b)) return Infinity;
  const n = await db.unit.count({ where: { buildingId: b.id } });
  return Math.max(0, FREE_UNIT_LIMIT - n);
}

/** Започва абонамент: Stripe Checkout (subscription) или директно активиране в тестов режим. */
export async function startSubscription(buildingId: string, email: string): Promise<string> {
  const b = await db.building.findUniqueOrThrow({ where: { id: buildingId } });
  const units = await db.unit.count({ where: { buildingId } });
  if (mockMode()) {
    await db.building.update({
      where: { id: buildingId },
      data: { plan: "PRO", subscriptionStatus: "active", currentPeriodEnd: new Date(Date.now() + 30 * 864e5) },
    });
    return "/billing?success=1";
  }
  const price = process.env.STRIPE_PRO_PRICE_ID;
  if (!price) throw new Error("STRIPE_PRO_PRICE_ID не е зададен");
  const s = stripe();
  let customer = b.stripeCustomerId;
  if (!customer) {
    customer = (await s.customers.create({ email, name: b.name, metadata: { buildingId } })).id;
    await db.building.update({ where: { id: buildingId }, data: { stripeCustomerId: customer } });
  }
  const base = await appUrl();
  const session = await s.checkout.sessions.create({
    mode: "subscription",
    locale: "bg",
    customer,
    line_items: [{ price, quantity: Math.max(1, units) }],
    subscription_data: { metadata: { buildingId } },
    metadata: { buildingId },
    tax_id_collection: { enabled: true },
    customer_update: { name: "auto", address: "auto" },
    success_url: `${base}/billing?success=1`,
    cancel_url: `${base}/billing`,
  });
  return session.url!;
}

/** Stripe Customer Portal — фактури, смяна на карта, отказ. В тестов режим — директен отказ. */
export async function manageSubscription(buildingId: string): Promise<string> {
  const b = await db.building.findUniqueOrThrow({ where: { id: buildingId } });
  if (mockMode() || !b.stripeCustomerId) {
    await db.building.update({ where: { id: buildingId }, data: { plan: "FREE", subscriptionStatus: "canceled", currentPeriodEnd: null } });
    return "/billing?canceled=1";
  }
  const portal = await stripe().billingPortal.sessions.create({ customer: b.stripeCustomerId, return_url: `${await appUrl()}/billing` });
  return portal.url;
}

/** Обновява броя обекти в абонамента (таксуване на обект). */
export async function syncSubscriptionQuantity(buildingId: string) {
  const b = await db.building.findUnique({ where: { id: buildingId } });
  if (!b?.stripeSubscriptionId || mockMode()) return;
  try {
    const units = await db.unit.count({ where: { buildingId } });
    const sub = await stripe().subscriptions.retrieve(b.stripeSubscriptionId);
    const item = sub.items.data[0];
    if (item && item.quantity !== units) {
      await stripe().subscriptionItems.update(item.id, { quantity: Math.max(1, units), proration_behavior: "create_prorations" });
    }
  } catch (e) {
    console.error("[billing] quantity sync failed", e);
  }
}

/** Прилага състояние на абонамент от Stripe (от webhook). */
export async function applySubscription(sub: { id: string; status: string; customer: string | { id: string }; metadata?: Record<string, string>; items?: { data: { current_period_end?: number }[] }; current_period_end?: number }) {
  const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const end = sub.current_period_end ?? sub.items?.data[0]?.current_period_end;
  const active = ["active", "trialing", "past_due"].includes(sub.status);
  const where = sub.metadata?.buildingId ? { id: sub.metadata.buildingId } : { stripeCustomerId: customer };
  await db.building.updateMany({
    where,
    data: {
      plan: active ? "PRO" : "FREE",
      subscriptionStatus: sub.status,
      stripeSubscriptionId: sub.id,
      stripeCustomerId: customer,
      currentPeriodEnd: end ? new Date(end * 1000) : null,
    },
  });
}
