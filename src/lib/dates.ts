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
