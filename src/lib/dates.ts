import { getDaysInMonth, parse } from "date-fns";

const saoPauloDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// yyyy-MM-dd in Brazil, so server (UTC) and browser agree on "today"
export function getTodayInSaoPaulo(now: Date = new Date()): string {
  return saoPauloDate.format(now);
}

// Due day within the month, capped at its last day (31 Oct -> 30 Nov)
export function dateInMonth(monthRef: string, day: number | undefined): string {
  const lastDay = getDaysInMonth(parse(monthRef, "yyyy-MM", new Date()));
  const safeDay = Math.min(Math.max(day ?? 1, 1), lastDay);
  return `${monthRef}-${String(safeDay).padStart(2, "0")}`;
}
