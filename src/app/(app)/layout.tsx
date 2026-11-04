import Link from "next/link";
import { requireMembership } from "@/lib/auth";
import { logout } from "../(auth)/actions";
import { switchBuilding } from "./actions";
import { NavLinks } from "./NavLinks";
import { BuildingSelect } from "./BuildingSelect";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, building, memberships, isManager, membership } = await requireMembership();
  const links = [
    { href: "/dashboard", label: "Табло", icon: "🏠" },
    ...(isManager ? [{ href: "/units", label: "Обекти", icon: "🚪" }] : []),
    { href: "/finance", label: isManager ? "Такси и плащания" : "Моите задължения", icon: "💶" },
    { href: "/expenses", label: "Разходи", icon: "🧾" },
    { href: "/announcements", label: "Обяви", icon: "📢" },
    { href: "/polls", label: "Гласувания", icon: "🗳️" },
    { href: "/issues", label: "Сигнали", icon: "🛠️" },
    ...(isManager ? [{ href: "/settings", label: "Настройки", icon: "⚙️" }] : []),
  ];
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-slate-200 bg-white md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex h-full flex-col p-4">
          <Link href="/dashboard" className="mb-4 text-xl font-bold text-brand-700">🏠 Входът</Link>
          <form action={switchBuilding} className="mb-4">
            <BuildingSelect current={building.id} options={memberships.map((m) => ({ id: m.buildingId, name: m.building.name }))} />
            <noscript><button className="btn-secondary btn-sm mt-1">Смени</button></noscript>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
              <span>{isManager ? "Управител" : membership.unit ? `Обект ${membership.unit.number}` : "Обитател"}</span>
              <Link href="/onboarding" className="text-brand-600 hover:underline">+ сграда</Link>
            </div>
          </form>
          <NavLinks links={links} />
          <div className="mt-auto hidden border-t pt-4 text-sm md:block">
            <div className="font-medium">{user.name}</div>
            <div className="truncate text-xs text-slate-500">{user.email}</div>
            <form action={logout}><button className="mt-2 text-xs text-red-600 hover:underline">Изход</button></form>
          </div>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-6xl">{children}</div>
        <form action={logout} className="mt-8 md:hidden"><button className="text-xs text-red-600">Изход ({user.email})</button></form>
      </main>
    </div>
  );
}
