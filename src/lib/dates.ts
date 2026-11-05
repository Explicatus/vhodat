/** Днешната дата в България (сървърът може да е в друга часова зона). */
export function sofiaToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Sofia", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { period: `${get("year")}-${get("month")}`, day: Number(get("day")) };
}

