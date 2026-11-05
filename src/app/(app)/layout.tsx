import Link from "next/link";
import { requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import { logout } from "../(auth)/actions";
import { switchBuilding } from "./actions";
import { NavLinks } from "./NavLinks";
import { BuildingSelect } from "./BuildingSelect";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, building, memberships, isManager, membership } = await requireMembership();
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  const links = [
    { href: "/dashboard", label: "Табло", icon: "🏠" },
    ...(isManager ? [{ href: "/units", label: "Обекти", icon: "🚪" }] : []),
    { href: "/finance", label: isManager ? "Такси и плащания" : "Моите задължения", icon: "💶" },
    { href: "/expenses", label: "Разходи", icon: "🧾" },
    { href: "/announcements", label: "Обяви", icon: "📢" },
    { href: "/polls", label: "Гласувания", icon: "🗳️" },
    { href: "/issues", label: "Сигнали", icon: "🛠️" },
    { href: "/notifications", label: "Известия", icon: "🔔", badge: unread },
    ...(isManager ? [{ href: "/settings", label: "Настройки", icon: "⚙️" }, { href: "/billing", label: "Абонамент", icon: "⭐" }] : []),
  ];
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="sticky top-0 z-20 p-2 md:h-screen md:w-72 md:shrink-0 md:p-3">
        <div className="glass flex h-full flex-col rounded-[28px] p-3 md:p-4">
          <div className="mb-3 flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2 text-lg font-bold">
              <span className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-600 text-white shadow-lg shadow-indigo-500/30">⌂</span>
              Входът
            </Link>
            <Link href="/notifications" className="relative grid h-9 w-9 place-items-center rounded-full glass md:hidden" aria-label="Известия">
              🔔{unread > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{unread}</span>}
            </Link>
          </div>
          <form action={switchBuilding} className="mb-3">
            <BuildingSelect current={building.id} options={memberships.map((m) => ({ id: m.buildingId, name: m.building.name }))} />
            <noscript><button className="btn-secondary btn-sm mt-1">Смени</button></noscript>
            <div className="mt-1.5 flex items-center justify-between px-1 text-xs text-slate-500">
              <span>{isManager ? "Управител" : membership.unit ? `Обект ${membership.unit.number}` : "Обитател"}</span>
              <Link href="/onboarding" className="text-brand-600 hover:underline">+ сграда</Link>
            </div>
          </form>
          <NavLinks links={links} />
          <div className="mt-auto hidden pt-4 md:block">
            <div className="glass flex items-center gap-3 rounded-2xl p-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-fuchsia-400 to-indigo-500 text-sm font-bold text-white">{user.name.slice(0, 1)}</span>
              <div className="min-w-0 flex-1">
                <Link href="/profile" className="block truncate text-sm font-semibold hover:underline">{user.name}</Link>
                <form action={logout}><button className="text-xs text-slate-500 hover:text-red-600">Изход</button></form>
              </div>
            </div>
          </div>
        </div>
      </aside>
      <main className="flex-1 px-3 pb-10 pt-2 md:p-8">
        <div className="mx-auto max-w-6xl">
          {!user.emailVerifiedAt && (
            <div className="glass mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-2.5 text-sm">
              <span>📧 Потвърдете имейла си ({user.email}) — пратихме ви линк.</span>
              <Link href="/profile" className="text-brand-600 hover:underline">Изпрати отново</Link>
            </div>
          )}
          {children}
        </div>
        <div className="mt-8 flex gap-4 text-xs md:hidden"><Link href="/profile" className="text-brand-600">Профил</Link><form action={logout}><button className="text-red-600">Изход ({user.email})</button></form></div>
      </main>
    </div>
  );
}
