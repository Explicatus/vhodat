export const money = (n: number) =>
  new Intl.NumberFormat("bg-BG", { style: "currency", currency: "EUR" }).format(n);

export const date = (d: Date | string) =>
  new Intl.DateTimeFormat("bg-BG", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d));

export const dateTime = (d: Date | string) =>
  new Intl.DateTimeFormat("bg-BG", { dateStyle: "short", timeStyle: "short" }).format(new Date(d));

const MONTHS = ["Януари","Февруари","Март","Април","Май","Юни","Юли","Август","Септември","Октомври","Ноември","Декември"];
export const periodLabel = (p: string) => {
  const [y, m] = p.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};
export const currentPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const EXPENSE_CATEGORIES: Record<string, string> = {
  ELECTRICITY: "Електричество (общи части)",
  CLEANING: "Почистване",
  ELEVATOR: "Асансьор (поддръжка)",
  REPAIR: "Ремонт",
  WATER: "Вода (общи части)",
  MANAGEMENT: "Управление / домоуправител",
  OTHER: "Друго",
};

export const CHARGE_TYPES: Record<string, string> = {
  MONTHLY: "Месечна такса",
  REPAIR_FUND: "Фонд „Ремонт и обновяване“",
  ONE_TIME: "Еднократна вноска",
};

export const PAYMENT_METHODS: Record<string, string> = { CASH: "В брой", BANK: "Банков превод", CARD: "Карта" };

export const UNIT_KINDS: Record<string, string> = {
  APARTMENT: "Апартамент", SHOP: "Магазин", OFFICE: "Офис / ателие", GARAGE: "Гараж",
};

export const ISSUE_STATUS: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "Нов", cls: "bg-red-100 text-red-700" },
  IN_PROGRESS: { label: "В процес", cls: "bg-amber-100 text-amber-700" },
  RESOLVED: { label: "Решен", cls: "bg-green-100 text-green-700" },
};
