"use client";

import {
  isServer,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { MONTH_QUERY_ROOT } from "@/hooks/use-month-data";
import { TRANSACTION_UPDATED_EVENT } from "@/lib/events";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (isServer) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  // Any save refreshes every cached month (a deferral touches two months)
  useEffect(() => {
    const invalidate = () =>
      queryClient.invalidateQueries({ queryKey: [MONTH_QUERY_ROOT] });
    window.addEventListener(TRANSACTION_UPDATED_EVENT, invalidate);
    return () =>
      window.removeEventListener(TRANSACTION_UPDATED_EVENT, invalidate);
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
