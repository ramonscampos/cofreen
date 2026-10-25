import {
  boolean,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

// --- Auth.js Tables ---
export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  }),
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => ({
    compositePk: primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  }),
);

// --- Application Tables ---

export const cards = pgTable("cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  bankName: text("bank_name").notNull(),
  description: text("description"),
  dueDay: integer("due_day").notNull(),
  color: text("color").notNull().default("#000000"),
  pluggyAccountId: text("pluggy_account_id").unique(),
  pluggyItemId: text("pluggy_item_id"),
  closingDay: integer("closing_day"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

export const recurringTemplates = pgTable("recurring_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["incoming", "expense"] }).notNull(),
  description: text("description").notNull(),
  defaultAmount: numeric("default_amount").notNull(),
  dayOfMonth: integer("day_of_month").notNull(),
  isActive: boolean("is_active").default(true),
  monthRef: text("month_ref"), // Format YYYY-MM (optional for templates)
  installmentCurrent: integer("installment_current"),
  installmentTotal: integer("installment_total"),
  planId: uuid("plan_id"),
  cardId: uuid("card_id").references(() => cards.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["incoming", "expense"] }).notNull(),
  monthRef: text("month_ref").notNull(), // Format YYYY-MM
  description: text("description").notNull(),
  amount: numeric("amount").notNull(),
  paid: boolean("paid").default(false),
  isRecurring: boolean("is_recurring").default(false),
  templateId: uuid("template_id").references(() => recurringTemplates.id, {
    onDelete: "set null",
  }),
  cardId: uuid("card_id").references(() => cards.id, { onDelete: "set null" }),
  installmentCurrent: integer("installment_current"),
  installmentTotal: integer("installment_total"),
  transactionDate: timestamp("transaction_date", {
    withTimezone: true,
    mode: "string",
  }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

export const cardTransactions = pgTable("card_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  cardId: uuid("card_id")
    .notNull()
    .references(() => cards.id, { onDelete: "cascade" }),
  monthRef: text("month_ref").notNull(), // Format YYYY-MM
  description: text("description").notNull(),
  amount: numeric("amount").notNull(),
  installmentTotal: integer("installment_total"),
  installmentCurrent: integer("installment_current"),
  externalId: text("external_id").unique(),
  billExternalId: text("bill_external_id"),
  purchaseDate: text("purchase_date"), // Format YYYY-MM-DD
  category: text("category"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

export const cardBills = pgTable("card_bills", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  cardId: uuid("card_id")
    .notNull()
    .references(() => cards.id, { onDelete: "cascade" }),
  externalId: text("external_id").notNull().unique(),
  monthRef: text("month_ref").notNull(), // Format YYYY-MM (due month)
  dueDate: text("due_date").notNull(), // Format YYYY-MM-DD
  closingDate: text("closing_date"), // Format YYYY-MM-DD
  totalAmount: numeric("total_amount").notNull(),
  paidAmount: numeric("paid_amount").notNull().default("0"),
  hasPaymentInfo: boolean("has_payment_info").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

export const syncStatus = pgTable("sync_status", {
  id: text("id").primaryKey(), // Always "pluggy"
  lastSuccessAt: timestamp("last_success_at", {
    withTimezone: true,
    mode: "string",
  }),
  lastErrorAt: timestamp("last_error_at", {
    withTimezone: true,
    mode: "string",
  }),
  lastError: text("last_error"),
  consentExpiresAt: timestamp("consent_expires_at", {
    withTimezone: true,
    mode: "string",
  }),
});
