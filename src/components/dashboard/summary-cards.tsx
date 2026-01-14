import { ArrowDownCircle, ArrowUpCircle, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SummaryCardsProps {
  incoming: number;
  expense: number;
  total: number;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function SummaryCards({ incoming, expense, total }: SummaryCardsProps) {
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
            {formatCurrency(incoming)}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#323238] border-none text-white">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-normal text-zinc-300">
            Saídas
          </CardTitle>
          <ArrowDownCircle className="h-8 w-8 text-[#f75a68]" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-white mt-4">
            {formatCurrency(expense)}
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
            {formatCurrency(total)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
