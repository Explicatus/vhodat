"use client";
export function BuildingSelect({ current, options }: { current: string; options: { id: string; name: string }[] }) {
  return (
    <select name="buildingId" defaultValue={current} className="input text-xs font-medium" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
      {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  );
}
