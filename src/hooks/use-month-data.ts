"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getNextMonthRef, getPreviousMonthRef } from "@/lib/finance-logic";
import type { MonthData } from "@/lib/month-data";
import { fetchMonthData, UnauthorizedError } from "@/services/month-client";

export const MONTH_QUERY_ROOT = "month";

const monthQuery = (monthRef: string) => ({
  queryKey: [MONTH_QUERY_ROOT, monthRef],
  queryFn: () => fetchMonthData(monthRef),
  // An expired session won't fix itself by retrying
  retry: (failureCount: number, error: Error) =>
    !(error instanceof UnauthorizedError) && failureCount < 2,
});

// Month data from the shared cache; neighbours are prefetched so switching
// months is usually instant
export function useMonthData(monthRef: string, initialData?: MonthData) {
  const queryClient = useQueryClient();
  // initialData avoids a skeleton flash on the first, server-rendered month
  const query = useQuery({ ...monthQuery(monthRef), initialData });

  useEffect(() => {
    if (query.error instanceof UnauthorizedError) {
      window.location.href = "/login";
    }
  }, [query.error]);

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

// A server render carries fresh data: put it in the cache and mark the
// other cached months stale, so coming back from another page never shows
// older data than the server just sent
export function useSeedMonthData(monthRef: string, data: MonthData) {
  const queryClient = useQueryClient();
  useEffect(() => {
    queryClient.setQueryData([MONTH_QUERY_ROOT, monthRef], data);
    queryClient.invalidateQueries({
      queryKey: [MONTH_QUERY_ROOT],
      predicate: (query) => query.queryKey[1] !== monthRef,
      refetchType: "none",
    });
  }, [queryClient, monthRef, data]);
}
