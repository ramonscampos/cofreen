import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentMonthRef } from "@/lib/finance-logic";
import { getMonthData } from "@/lib/month-data";
import { DashboardView } from "../dashboard-view";

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
  const monthRef = params.month || getCurrentMonthRef();

  const monthData = await getMonthData(session.user.id, monthRef);

  return (
    <DashboardView
      initialMonthRef={monthRef}
      initialTransactions={monthData.transactions}
      initialTemplates={monthData.templates}
      initialCards={monthData.cards}
      initialCardTransactions={monthData.cardTransactions}
    />
  );
}
