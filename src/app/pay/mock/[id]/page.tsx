import { notFound } from "next/navigation";
import { requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { mockMode } from "@/lib/payments";
import { SubmitButton } from "@/components/SubmitButton";
import { completeMockPayment } from "../../actions";

/** Симулирана страница за плащане — замества Stripe Checkout в тестов режим. */
export default async function MockCheckout({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireMembership();
  if (!mockMode()) notFound();
  const op = await db.onlinePayment.findFirst({ where: { id, userId: user.id }, include: { unit: true, building: true } });
  if (!op || op.status !== "PENDING") notFound();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-3 rounded-lg bg-amber-500/15 p-3 text-center text-xs font-medium text-amber-800">
          🧪 ТЕСТОВ РЕЖИМ — няма реално плащане. С истински Stripe ключ тук ще се отвори Stripe Checkout.
        </div>
        <div className="card space-y-4">
          <div>
            <div className="text-sm text-slate-500">{op.building.name}</div>
            <div className="text-lg font-semibold">Такси — обект {op.unit.number}</div>
            <div className="mt-2 text-3xl font-bold">{money(op.amountCents)}</div>
          </div>
          <div className="space-y-2">
            <input className="input font-mono" defaultValue="4242 4242 4242 4242" readOnly />
            <div className="grid grid-cols-2 gap-2">
              <input className="input font-mono" defaultValue="12 / 30" readOnly />
              <input className="input font-mono" defaultValue="123" readOnly />
            </div>
          </div>
          <form action={completeMockPayment.bind(null, op.id, true)}>
            <SubmitButton className="btn-primary w-full py-3">Плати {money(op.amountCents)}</SubmitButton>
          </form>
          <form action={completeMockPayment.bind(null, op.id, false)}>
            <SubmitButton className="btn-secondary w-full">Откажи</SubmitButton>
          </form>
        </div>
      </div>
    </div>
  );
}
