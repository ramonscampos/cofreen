export interface PluggyItem {
  id: string;
  status: string;
  consentExpiresAt?: string | null;
  error?: { code: string; message?: string } | null;
}

export interface PluggyAccount {
  id: string;
  type: "BANK" | "CREDIT";
  name: string;
  balance: number;
  marketingName?: string | null;
  number?: string | null;
  creditData?: { balanceDueDate?: string | null } | null;
}

export interface PluggyBill {
  id: string;
  dueDate: string;
  billClosingDate?: string | null;
  totalAmount: number;
  payments?: { amount: number }[] | null;
}

export interface PluggyTransaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: "DEBIT" | "CREDIT";
  category?: string | null;
  categoryId?: string | null;
  creditCardMetadata?: {
    installmentNumber?: number | null;
    totalInstallments?: number | null;
    billId?: string | null;
    billForecastDate?: string | null;
    purchaseDate?: string | null;
  } | null;
}

export interface PluggyCategory {
  id: string;
  description: string;
  descriptionTranslated?: string | null;
}

export interface PluggyPage<T> {
  page: number;
  totalPages: number;
  results: T[];
}
