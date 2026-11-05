import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { markOnlinePaid, stripe } from "@/lib/payments";
import { applySubscription } from "@/lib/billing";

/**
 * Stripe webhook. Настройте endpoint към /api/stripe/webhook със събития:
 *   checkout.session.completed, checkout.session.async_payment_succeeded,
 *   checkout.session.expired, customer.subscription.created/updated/deleted, account.updated (за Connect — „Listen to events on Connected accounts“)
 */
export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return new NextResponse("Webhook not configured", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), sig, secret);
  } catch (e) {
    return new NextResponse(`Invalid signature: ${(e as Error).message}`, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.mode === "subscription" && typeof s.subscription === "string") {
        await applySubscription(await stripe().subscriptions.retrieve(s.subscription) as never);
        break;
      }
      const id = s.metadata?.onlinePaymentId;
      if (id && s.payment_status === "paid") await markOnlinePaid(id, s.id);
      break;
    }
    case "checkout.session.expired": {
      const s = event.data.object as Stripe.Checkout.Session;
      const id = s.metadata?.onlinePaymentId;
      if (id) await db.onlinePayment.updateMany({ where: { id, status: "PENDING" }, data: { status: "CANCELED" } });
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await applySubscription(event.data.object as never);
      break;
    case "account.updated": {
      const a = event.data.object as Stripe.Account;
      await db.building.updateMany({ where: { stripeAccountId: a.id }, data: { stripeChargesEnabled: !!a.charges_enabled } });
      break;
    }
  }
  return NextResponse.json({ received: true });
}
