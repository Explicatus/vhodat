import "server-only";
import Stripe from "stripe";
import { headers } from "next/headers";
import { db } from "./db";
import { round } from "./finance";
import { notify } from "./notify";

let _stripe: Stripe | null = null;
export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY не е зададен");
  return (_stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY));
}

export const stripeConfigured = () => !!process.env.STRIPE_SECRET_KEY;
/** Тестов режим: симулирано плащане без Stripe. Изключен, ако има Stripe ключ. */
export const mockMode = () => !stripeConfigured() && process.env.PAYMENTS_MOCK === "1";
export const platformFeePercent = () => Math.max(0, parseFloat(process.env.PLATFORM_FEE_PERCENT || "0") || 0);

export const MIN_ONLINE = 1;
export const MAX_ONLINE = 10000;

export async function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

/** Може ли етажната собственост да приема онлайн плащания? */
export function onlineEnabled(b: { stripeAccountId: string | null; stripeChargesEnabled: boolean }) {
  return mockMode() || (stripeConfigured() && !!b.stripeAccountId && b.stripeChargesEnabled);
}

/**
 * Отбелязва онлайн плащане като платено и създава запис в касата.
 * Идемпотентно — безопасно е да се извика многократно (webhook + връщане от Stripe).
 */
export async function markOnlinePaid(onlinePaymentId: string, providerRef?: string) {
  let fresh = false;
  const res = await db.$transaction(async (tx) => {
    const op = await tx.onlinePayment.findUnique({ where: { id: onlinePaymentId } });
    if (!op || op.status === "PAID") return op;
    fresh = true;
    const payment = await tx.payment.create({
      data: { unitId: op.unitId, amount: op.amount, method: "CARD", note: "Онлайн плащане с карта", paidAt: new Date() },
    });
    return tx.onlinePayment.update({
      where: { id: op.id },
      data: { status: "PAID", paidAt: new Date(), paymentId: payment.id, providerRef: providerRef ?? op.providerRef },
    });
  });
  if (fresh && res) {
    const unit = await db.unit.findUnique({ where: { id: res.unitId } });
    const amt = new Intl.NumberFormat("bg-BG", { style: "currency", currency: "EUR" }).format(res.amount);
    await notify({ buildingId: res.buildingId, unitIds: [res.unitId] }, { title: "Плащането е успешно", body: `Получихме ${amt} с карта за обект ${unit?.number}.`, link: "/finance" });
    await notify({ buildingId: res.buildingId, roles: ["MANAGER"] }, { title: "💳 Онлайн плащане", body: `Обект ${unit?.number} плати ${amt} с карта.`, link: "/finance" });
  }
  return res;
}

/** Създава Stripe Checkout сесия (destination charge към сметката на ЕС). Връща URL за пренасочване. */
export async function createStripeCheckout(opts: {
  onlinePaymentId: string; amount: number; fee: number; destination: string;
  buildingName: string; unitNumber: string; email: string;
}) {
  const base = await appUrl();
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    locale: "bg",
    customer_email: opts.email,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "eur",
        unit_amount: Math.round(opts.amount * 100),
        product_data: { name: `Такси — обект ${opts.unitNumber}`, description: opts.buildingName },
      },
    }],
    payment_intent_data: {
      application_fee_amount: Math.round(opts.fee * 100) || undefined,
      transfer_data: { destination: opts.destination },
      on_behalf_of: opts.destination,
      metadata: { onlinePaymentId: opts.onlinePaymentId },
    },
    metadata: { onlinePaymentId: opts.onlinePaymentId },
    success_url: `${base}/pay/result?op=${opts.onlinePaymentId}`,
    cancel_url: `${base}/pay/result?op=${opts.onlinePaymentId}&canceled=1`,
  });
  await db.onlinePayment.update({ where: { id: opts.onlinePaymentId }, data: { providerRef: session.id } });
  return session.url!;
}

/** Синхронизира статуса от Stripe (резервен вариант, ако webhook-ът закъснее). */
export async function syncStripeSession(onlinePaymentId: string) {
  const op = await db.onlinePayment.findUnique({ where: { id: onlinePaymentId } });
  if (!op || op.status !== "PENDING" || op.provider !== "stripe" || !op.providerRef) return op;
  const session = await stripe().checkout.sessions.retrieve(op.providerRef);
  if (session.payment_status === "paid") return markOnlinePaid(op.id, session.id);
  return op;
}

export const feeFor = (amount: number) => round((amount * platformFeePercent()) / 100);
