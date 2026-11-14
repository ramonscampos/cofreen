import { addMonths, format, getDaysInMonth } from "date-fns";

// Month (yyyy-MM) of the due date of the bill that takes a purchase made on
// `date`. A purchase on the closing day already goes to the next bill, and a
// closing day past the end of the month falls on its last day.
export function billMonthForDate(
  date: Date,
  closingDay: number,
  dueDay: number,
): string {
  const effectiveClosing = Math.min(closingDay, getDaysInMonth(date));
  const closesThisMonth = date.getDate() < effectiveClosing;
  const closingMonth = addMonths(date, closesThisMonth ? 0 : 1);
  const dueMonth = addMonths(closingMonth, dueDay <= closingDay ? 1 : 0);
  return format(dueMonth, "yyyy-MM");
}
