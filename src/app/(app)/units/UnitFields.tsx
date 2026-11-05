import { UNIT_KINDS } from "@/lib/format";

type U = { number?: string; kind?: string; entrance?: string | null; floor?: number | null; area?: number | null; idealParts?: number; ownerName?: string | null; ownerEmail?: string | null; residents?: number; monthlyFeeCents?: number };

export function UnitFields({ u = {} }: { u?: U }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label><span className="label">Номер *</span><input name="number" required defaultValue={u.number} className="input" /></label>
      <label><span className="label">Вид</span>
        <select name="kind" defaultValue={u.kind ?? "APARTMENT"} className="input">
          {Object.entries(UNIT_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label><span className="label">Вход</span><input name="entrance" defaultValue={u.entrance ?? ""} className="input" /></label>
      <label><span className="label">Етаж</span><input name="floor" type="number" defaultValue={u.floor ?? ""} className="input" /></label>
      <label><span className="label">Площ (м²)</span><input name="area" inputMode="decimal" defaultValue={u.area ?? ""} className="input" /></label>
      <label><span className="label">Идеални части (%)</span><input name="idealParts" inputMode="decimal" defaultValue={u.idealParts ?? ""} className="input" /></label>
      <label><span className="label">Брой живущи</span><input name="residents" type="number" min={0} defaultValue={u.residents ?? 1} className="input" /></label>
      <label><span className="label">Месечна такса (€)</span><input name="monthlyFee" inputMode="decimal" defaultValue={u.monthlyFeeCents != null ? (u.monthlyFeeCents / 100).toFixed(2) : ""} className="input" /></label>
      <label className="sm:col-span-2"><span className="label">Собственик</span><input name="ownerName" defaultValue={u.ownerName ?? ""} className="input" /></label>
      <label className="sm:col-span-2"><span className="label">Имейл на собственика</span><input name="ownerEmail" type="email" defaultValue={u.ownerEmail ?? ""} className="input" /></label>
    </div>
  );
}
