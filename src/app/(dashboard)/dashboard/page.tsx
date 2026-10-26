import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTodayInSaoPaulo } from "@/lib/dates";
import { getCurrentMonthRef, normalizeMonthRef } from "@/lib/finance-logic";
import { getMonthData } from "@/lib/month-data";
import { DashboardView } from "../dashboard-view";

// The "Sincronizar agora" action runs under this page
export const maxDuration = 60;

interface SearchParams {
  month?: string;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    return redirect("/login");
  }

  // Resolve search params
  const params = await searchParams;
  const monthRef = normalizeMonthRef(params.month, getCurrentMonthRef());

  const monthData = await getMonthData(session.user.id, monthRef);

  return (
    <DashboardView
      initialMonthRef={monthRef}
      initialMonthData={monthData}
      today={getTodayInSaoPaulo()}
    />
  );
}
