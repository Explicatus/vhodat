"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ links }: { links: { href: string; label: string; icon: string; badge?: number }[] }) {
  const path = usePathname();
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0">
      {links.map((l) => {
        const active = path === l.href || path.startsWith(l.href + "/");
        return (
          <Link
            key={l.href}
            href={l.href}
            className={active ? "nav-pill nav-pill-active" : "nav-pill"}
          >
            <span>{l.icon}</span>{l.label}{!!l.badge && <span className="ml-auto rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{l.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
