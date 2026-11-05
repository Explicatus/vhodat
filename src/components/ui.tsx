import Link from "next/link";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ title, children, className = "", action }: { title?: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone = "default", action }: { label: string; value: string; hint?: string; tone?: "default" | "good" | "bad"; action?: React.ReactNode }) {
  const color = tone === "good" ? "text-green-600" : tone === "bad" ? "text-red-600" : "text-slate-900";
  return (
    <div className="card">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`mt-1 text-[28px] font-bold tracking-tight ${color}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
      {action}
    </div>
  );
}

export function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-slate-400/40 p-8 text-center text-sm text-slate-500">{children}</div>;
}

export function Badge({ children, className = "bg-slate-500/15 text-slate-700" }: { children: React.ReactNode; className?: string }) {
  return <span className={`badge ${className}`}>{children}</span>;
}

export function LinkButton({ href, children, variant = "primary" }: { href: string; children: React.ReactNode; variant?: "primary" | "secondary" }) {
  return <Link href={href} className={variant === "primary" ? "btn-primary" : "btn-secondary"}>{children}</Link>;
}
