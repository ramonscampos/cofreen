import { ArrowDownCircle, ArrowUpCircle, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { MonthTotals } from "@/lib/finance-logic";
import { formatCurrency } from "@/lib/format";

interface SummaryCardsProps {
  // null while the month is loading
  totals: MonthTotals | null;
}

function Amount({ value }: { value: number | undefined }) {
  return value === undefined ? (
    <Skeleton className="h-9 w-44" />
  ) : (
    formatCurrency(value)
  );
}

export function SummaryCards({ totals }: SummaryCardsProps) {
  return (
    <div className="grid gap-8 md:grid-cols-3 top-16 -mt-16 relative">
      <Card className="bg-[#323238] border-none text-white">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-normal text-zinc-300">
            Entradas
          </CardTitle>
          <ArrowUpCircle className="h-8 w-8 text-[#00b37e]" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-white mt-4">
            <Amount value={totals?.incoming} />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#323238] border-none text-white">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-normal text-zinc-300">
            Despesas
          </CardTitle>
          <ArrowDownCircle className="h-8 w-8 text-[#f75a68]" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-white mt-4">
            <Amount value={totals?.expense} />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#015f43] border-none text-white">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-normal text-zinc-200">
            Total
          </CardTitle>
          <DollarSign className="h-8 w-8 text-white" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-white mt-4">
            <Amount value={totals?.total} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
