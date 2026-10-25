import type { InferSelectModel } from "drizzle-orm";
import type {
  cardBills,
  cards,
  cardTransactions,
  syncStatus,
} from "@/db/schema";

export type Kind = "incoming" | "expense";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

export type Card = InferSelectModel<typeof cards>;

export interface RecurringTemplate {
  id: string;
  userId: string;
  kind: Kind;
  description: string;
  defaultAmount: string;
  dayOfMonth: number;
  monthRef?: string | null;
  isActive: boolean | null;
  installmentCurrent?: number | null;
  installmentTotal?: number | null;
  planId?: string | null;
  cardId?: string | null;
  createdAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  kind: Kind;
  monthRef: string; // YYYY-MM
  description: string;
  amount: string;
  paid: boolean | null;
  isRecurring: boolean | null;
  templateId?: string | null;
  cardId?: string | null;
  installmentCurrent?: number | null;
  installmentTotal?: number | null;
  createdAt: string;
  transactionDate?: string | null;
}

export type CardTransaction = InferSelectModel<typeof cardTransactions> & {
  isRecurring?: boolean;
};

export type CardBill = InferSelectModel<typeof cardBills>;

export type SyncStatus = InferSelectModel<typeof syncStatus>;

// Helper type for the unified list view
export interface DashboardItem {
  id: string; // Transaction ID or Template ID
  kind: Kind;
  description: string;
  amount: number;
  day?: number; // For ordering: from template.dayOfMonth or createdAt
  paid: boolean;
  isRecurring: boolean;
  originalTemplateId?: string; // If expected, this is the template ID
  transactionId?: string; // If real, the transaction ID
  installmentCurrent?: number;
  installmentTotal?: number;
  cardTransactions?: CardTransaction[]; // For card invoice items
  cardId?: string;
  cardColor?: string;
  isCardTransaction?: boolean;
  monthRef?: string;
}

export interface User {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
}

// Payload types for Server Actions to avoid 'any'
export interface CreateCardPayload {
  bankName: string;
  description?: string;
  dueDay: number;
  color: string;
}

export interface CreateTemplatePayload {
  kind: Kind;
  description: string;
  defaultAmount: string;
  dayOfMonth: number;
  monthRef?: string | null;
  isActive?: boolean;
  cardId?: string | null;
  installmentCurrent?: number | null;
  installmentTotal?: number | null;
  planId?: string | null;
}

export interface CreateTransactionPayload {
  description: string;
  amount: string | number;
  kind: Kind;
  monthRef: string;
  paid: boolean;
  day?: number;
  cardId?: string | null;
  templateId?: string | null;
  isRecurring?: boolean;
  installmentCurrent?: number | null;
  installmentTotal?: number | null;
  transactionDate?: string;
}
