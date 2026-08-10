import clsx, { type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/** Local date as YYYY-MM-DD (not UTC, so "today" matches the child's day). */
export function todayISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MONTHS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/** "vie 8 ago" — parses a YYYY-MM-DD string as a local date. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAYS[date.getDay()]} ${d} ${MONTHS[m - 1]}`;
}

export function relativeDay(iso: string): string | null {
  const today = todayISO();
  if (iso === today) return "Hoy";
  const [y, m, d] = today.split("-").map(Number);
  const yest = new Date(y, m - 1, d - 1);
  const yestISO = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, "0")}-${String(yest.getDate()).padStart(2, "0")}`;
  if (iso === yestISO) return "Ayer";
  return null;
}

/** 24h "HH:MM" → "9:30 a. m." */
export function formatTime(time: string | null): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const period = h < 12 ? "a. m." : "p. m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export const COLORS: Record<string, { bg: string; text: string; ring: string; dot: string }> = {
  teal: { bg: "bg-teal-100", text: "text-teal-800", ring: "ring-teal-500", dot: "bg-teal-500" },
  amber: { bg: "bg-amber-100", text: "text-amber-800", ring: "ring-amber-500", dot: "bg-amber-500" },
  violet: { bg: "bg-violet-100", text: "text-violet-800", ring: "ring-violet-500", dot: "bg-violet-500" },
  rose: { bg: "bg-rose-100", text: "text-rose-800", ring: "ring-rose-500", dot: "bg-rose-500" },
  sky: { bg: "bg-sky-100", text: "text-sky-800", ring: "ring-sky-500", dot: "bg-sky-500" },
  lime: { bg: "bg-lime-100", text: "text-lime-800", ring: "ring-lime-500", dot: "bg-lime-500" },
};

export const COLOR_KEYS = Object.keys(COLORS);

export function colorOf(key: string) {
  return COLORS[key] ?? COLORS.teal;
}

export function initials(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}
