import { redirect } from "next/navigation";
import { getCurrentMonthRef } from "@/lib/finance-logic";
import { createClient } from "@/lib/supabase/server";
import { DashboardView } from "../dashboard-view";

interface SearchParams {
  month?: string;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  // Resolve search params
  const params = await searchParams;
  const monthRef = params.month || getCurrentMonthRef();

  // Fetch initial data for the month
  // We fetch in parallel for performance
  const [transactionsRes, templatesRes, cardsRes, cardTransRes] =
    await Promise.all([
      supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .eq("month_ref", monthRef),

      supabase
        .from("recurring_templates")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true),

      supabase.from("cards").select("*").eq("user_id", user.id),

      supabase // For virtual bill calculation
        .from("card_transactions")
        .select("*")
        .eq("user_id", user.id)
        .eq("month_ref", monthRef),
    ]);

  return (
    <DashboardView
      user={user}
      initialMonthRef={monthRef}
      initialTransactions={transactionsRes.data || []}
      initialTemplates={templatesRes.data || []}
      initialCards={cardsRes.data || []}
      initialCardTransactions={cardTransRes.data || []}
    />
  );
}
