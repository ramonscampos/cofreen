"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getNextMonthRef, getPreviousMonthRef } from "@/lib/finance-logic";
import type { MonthData } from "@/lib/month-data";

export const MONTH_QUERY_ROOT = "month";

const monthQuery = (monthRef: string) => ({
  queryKey: [MONTH_QUERY_ROOT, monthRef],
  queryFn: async (): Promise<MonthData> => {
    const response = await fetch(`/api/month?month=${monthRef}`);
    if (!response.ok) throw new Error("Erro ao carregar o mês");
    return response.json();
  },
});

// Month data from the shared cache; neighbours are prefetched so switching
// months is usually instant
export function useMonthData(monthRef: string, initialData?: MonthData) {
  const queryClient = useQueryClient();
  const query = useQuery({ ...monthQuery(monthRef), initialData });

  useEffect(() => {
    for (const neighbour of [
      getPreviousMonthRef(monthRef),
      getNextMonthRef(monthRef),
    ]) {
      queryClient.prefetchQuery(monthQuery(neighbour));
    }
  }, [monthRef, queryClient]);

  return query;
}
