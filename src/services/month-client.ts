import type { MonthData } from "@/lib/month-data";

export class UnauthorizedError extends Error {}

export async function fetchMonthData(monthRef: string): Promise<MonthData> {
  const response = await fetch(`/api/month?month=${monthRef}`);
  if (response.status === 401) throw new UnauthorizedError("Sessão expirada");
  if (!response.ok) throw new Error("Erro ao carregar o mês");
  return response.json();
}
