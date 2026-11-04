import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { OnboardingForms } from "./OnboardingForms";

export default async function Onboarding() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Link href="/" className="text-xl font-bold text-brand-700">🏠 Входът</Link>
      <h1 className="mt-6 text-3xl font-bold">Здравейте, {user.name}!</h1>
      <p className="mt-2 text-slate-600">Създайте етажна собственост, ако сте домоуправител, или се присъединете с код от вашия управител.</p>
      <OnboardingForms />
    </div>
  );
}
