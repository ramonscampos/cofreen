import { addMonths, format } from "date-fns";

// Month (yyyy-MM) of the due date of the bill that takes a purchase made on
// `date`. A purchase on the closing day already goes to the next bill.
export function billMonthForDate(
  date: Date,
  closingDay: number,
  dueDay: number,
): string {
  const closesThisMonth = date.getDate() < closingDay;
  const closingMonth = addMonths(date, closesThisMonth ? 0 : 1);
  const dueMonth = addMonths(closingMonth, dueDay <= closingDay ? 1 : 0);
  return format(dueMonth, "yyyy-MM");
}
