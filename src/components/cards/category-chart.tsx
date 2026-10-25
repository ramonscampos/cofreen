import {
  type CategoryGroup,
  groupCategories,
} from "@/lib/cards/category-groups";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

interface CategoryChartProps {
  categories: { category: string; amount: number }[];
  color: string;
  selected: CategoryGroup | null;
  onSelect: (group: CategoryGroup | null) => void;
}

const MAX_CATEGORIES = 6;

export function CategoryChart({
  categories,
  color,
  selected,
  onSelect,
}: CategoryChartProps) {
  if (categories.length === 0) {
    return (
      <p className="text-sm text-zinc-500">Sem gastos para categorizar.</p>
    );
  }

  const rows = groupCategories(categories, MAX_CATEGORIES);
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const max = Math.max(...rows.map((row) => row.amount));

  return (
    <figure className="space-y-1" aria-label="Gastos por categoria">
      {rows.map((row) => {
        const share = total > 0 ? Math.round((row.amount / total) * 100) : 0;
        const isSelected = selected?.label === row.label;
        const isDimmed = !!selected && !isSelected;
        return (
          <button
            key={row.label}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(isSelected ? null : row)}
            className={cn(
              "w-full grid grid-cols-[minmax(6rem,10rem)_1fr_auto] items-center gap-3 rounded px-1 py-1 text-left text-sm transition-colors hover:bg-zinc-800/60",
              isSelected && "bg-zinc-800",
              isDimmed && "opacity-40",
            )}
            title={`${row.label}: ${formatCurrency(row.amount)} (${share}%)`}
          >
            <span className="truncate text-zinc-300">{row.label}</span>
            <span className="h-2 rounded-full bg-zinc-800">
              <span
                className="block h-2 rounded-full"
                style={{
                  width: `${(row.amount / max) * 100}%`,
                  backgroundColor: color,
                }}
              />
            </span>
            <span className="tabular-nums text-zinc-400 whitespace-nowrap">
              {formatCurrency(row.amount)}{" "}
              <span className="text-zinc-500">· {share}%</span>
            </span>
          </button>
        );
      })}
    </figure>
  );
}
