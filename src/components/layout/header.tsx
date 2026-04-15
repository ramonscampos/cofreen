"use client";

import { LogOut, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { getDashboardSummaryAction } from "@/app/actions/dashboard";
import { MonthSwitcher } from "@/components/dashboard/month-switcher";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { TRANSACTION_UPDATED_EVENT } from "@/lib/events";
import {
  calculateTotals,
  getCurrentMonthRef,
  mergeTransactionsAndTemplates,
} from "@/lib/finance-logic";

import type {
  Card,
  CardTransaction,
  RecurringTemplate,
  Transaction,
} from "@/types";

export function Header() {
  const _router = useRouter();
  const searchParams = useSearchParams();
  const monthRef = searchParams.get("month") || getCurrentMonthRef();

  const { data: session } = useSession();
  const user = session?.user;
  const [menuOpen, setMenuOpen] = useState(false);

  // Data state for Summary Cards
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [cardTransactions, setCardTransactions] = useState<CardTransaction[]>(
    [],
  );

  useEffect(() => {
    const fetchData = async () => {
      if (user) {
        const result = await getDashboardSummaryAction(monthRef);
        if (result.success && result.data) {
          setTransactions(result.data.transactions);
          setTemplates(result.data.templates);
          setCards(result.data.cards);
          setCardTransactions(result.data.cardTransactions);
        }
      }
    };

    fetchData();

    // Listen for updates
    const handleUpdate = () => fetchData();
    if (typeof window !== "undefined") {
      window.addEventListener(TRANSACTION_UPDATED_EVENT, handleUpdate);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(TRANSACTION_UPDATED_EVENT, handleUpdate);
      }
    };
  }, [user, monthRef]); // Re-fetch when month changes

  const items = useMemo(() => {
    return mergeTransactionsAndTemplates(
      transactions,
      templates,
      monthRef,
      cards,
      cardTransactions,
    );
  }, [transactions, templates, monthRef, cards, cardTransactions]);

  const totals = useMemo(() => {
    return calculateTotals(items);
  }, [items]);

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <header className="relative w-full pt-8 mb-16">
      {/* Background Layer - z-0 */}
      <div className="absolute inset-0 bg-[#121214] z-0" />

      {/* Content Layer - z-20 (above Cards) */}
      <div className="container mx-auto px-4 md:px-6 relative z-20">
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Image
                src="/logo-inverse.svg"
                alt="CoFreen"
                width={120}
                height={32}
                className="h-8 w-auto"
                priority
              />
            </Link>
          </div>

          <div className="absolute left-1/2 transform -translate-x-1/2">
            <MonthSwitcher monthRef={monthRef} />
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-[#00875f] focus:outline-none transition-transform hover:scale-105"
            >
              {user?.image ? (
                <Image
                  src={user.image}
                  alt={user.name || "User"}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                  <User className="w-6 h-6 text-zinc-400" />
                </div>
              )}
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-14 w-48 bg-[#202024] border border-zinc-800 rounded-md shadow-xl z-50 py-1 flex flex-col">
                  <div className="px-4 py-3 border-b border-zinc-800 mb-1">
                    <p className="text-sm font-medium text-white truncate">
                      {user?.name || "Usuário"}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">
                      {user?.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-[#29292e] transition-colors w-full text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <SummaryCards
          incoming={totals.incoming}
          expense={totals.expense}
          total={totals.total}
        />
      </div>
    </header>
  );
}
