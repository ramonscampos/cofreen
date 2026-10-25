# Pluggy Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manually entered credit card bills with bills and purchases synced daily from Pluggy (Meu Pluggy). Show them in a separate cards section with a category chart, purchase list and forecast for future months, and fix installment amounts.

**Architecture:** A server-only Pluggy client plus a sync service upsert cards, bills and purchases into Postgres. Vercel Cron triggers it daily, and a "Sincronizar agora" button triggers it on demand. Pure functions in `src/lib/cards/` turn the stored rows into a per-month `CardBillView`: real bill, open bill or forecast, with status, purchases and categories. The dashboard's main list keeps only incomes, expenses and templates. Cards render in their own section, and month totals add the bills.

**Tech Stack:** Next.js 16 App Router, React 19, Drizzle ORM + Neon (`drizzle-kit push`), Auth.js, Tailwind 4, date-fns 4, Vitest (new dev dependency, approved), Pluggy REST API via `fetch` (no SDK).

**Spec:** `docs/superpowers/specs/2026-10-25-pluggy-cards-design.md`

## Global Constraints

- Single user. The sync attributes data to the `user` row whose email equals `process.env.ALLOWED_EMAIL`.
- Secrets live only on the server: `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`, `PLUGGY_ITEM_IDS` (comma-separated), `CRON_SECRET`. Never import `src/lib/pluggy/*` from a client component. The repo is **public**.
- Pluggy API base `https://api.pluggy.ai`. Auth: `POST /auth {clientId, clientSecret}` → `{ apiKey }`, sent as header `X-API-KEY`.
- No new runtime dependencies. The only new dev dependency is `vitest`. The chart is plain SVG/HTML.
- UI copy in Portuguese. Code identifiers in English. Follow existing Tailwind dark palette (`#202024`, `#29292e`, `#323238`, `#00b37e`, `#f75a68`).
- Bill month = month (`yyyy-MM`) of the bill's **due date**.
- Status labels (exact copy): `Paga`, `Paga (inferido)`, `Parcialmente paga`, `Fechada`, `Aberta`, `Prevista`.
- Recurring detection: non-installment purchase whose normalized description appears in **both of the last 2 closed bills** of the card, with amounts within **±10%**. It is projected with the most recent amount.
- Forecasts are computed at read time, never stored.
- Money comparisons use a 0.01 tolerance. Card purchase `amount` is stored **per installment**, signed: purchase > 0, refund/credit < 0.
- Lint: `yarn lint` (Biome). Types: `npx tsc --noEmit`. Tests: `yarn test`.

## Review Focus

1. **Card bill payment rows inside the card account** (Pluggy returns the bill payment as a CREDIT transaction). They must be excluded, or every open bill drops to ~0. Test owned by Task 3.
2. **Same installment purchase in several synced months** (3/10 in Oct, 4/10 in Nov open bill). The forecast must project from the latest real month only, never double count. Test owned by Task 4.
3. **Viewing a past month older than the synced window, or a card with no bills at all.** This must render an empty state (`amount 0`, no status crash), not throw. Test owned by Task 4.
4. **Sync partially failing** (one item expired, `USER_AUTHORIZATION_EXPIRED`). Other items still sync, the error is recorded in `sync_status`, and the UI shows a warning. Test owned by Task 3 (pure aggregation of item results).
5. **Template installment paid in a month** (Fastback). The month total must count 2.800, both projected and after "marcar como pago". Test owned by Task 1.

---

### Task 1: Vitest setup + installment-paid fix

**Files:**
- Create: `vitest.config.ts`, `src/lib/finance-logic.test.ts`
- Modify: `package.json` (devDependency `vitest`, script `"test": "vitest run"`), `src/app/(dashboard)/dashboard-view.tsx` (`handleMarkAsPaid`, template branch)

**Interfaces:**
- Produces: `yarn test` command. Unchanged signatures of `mergeTransactionsAndTemplates` and `calculateTotals`.

- [ ] **Step 1: Install and configure.** Run `yarn add -D vitest`. In `vitest.config.ts`, set `resolve.alias` `{ "@": path.resolve(__dirname, "src") }` and `test.environment: "node"`. Add the `test` script.
- [ ] **Step 2: Write failing tests** in `src/lib/finance-logic.test.ts`. Use a Fastback template: `defaultAmount "50400"`, `installmentCurrent 1`, `installmentTotal 18`, `monthRef "2026-02"`, `kind "expense"`, `dayOfMonth 1`.
  - `projects installment 10/18 at 2800 in 2026-11`: `calculateTotals(merge([], [tpl], "2026-11")).expense === 2800`, and the item has `installmentCurrent 10`.
  - `stops after last installment`: there is no item in `"2027-08"`.
  - `paid installment transaction counts the installment, not the contract`: transaction `{templateId: tpl.id, monthRef "2026-11", amount "50400", paid true, installmentCurrent 10, installmentTotal 18}`. Then `expense === 2800`, and there is exactly one item.
- [ ] **Step 3: Run** `yarn test`. Expected: the first two PASS (existing logic). If the third fails, inspect: the logic already divides when the fields exist, so the bug is in the caller.
- [ ] **Step 4: Fix the caller.** In `handleMarkAsPaid`, template branch, pass `installmentCurrent: item.installmentCurrent ?? null` and `installmentTotal: item.installmentTotal ?? null` to `createTransactionAction`.
- [ ] **Step 5: Run** `yarn test && npx tsc --noEmit && yarn lint`. Expected: all pass.
- [ ] **Step 6: Commit** `fix: keep installment info when paying an installment template`.

### Task 2: Schema for synced cards

**Files:**
- Modify: `src/db/schema.ts`, `src/types/index.ts`, `package.json` (script `"db:push": "drizzle-kit push"`)

**Interfaces:**
- Produces (Drizzle tables, exported from `@/db/schema`):
  - `cards` + `pluggyAccountId text unique`, `pluggyItemId text`, `closingDay integer` (nullable). `dueDay` is kept and written by the sync. `bankName` is the display name, editable.
  - `cardBills` (`card_bills`): `id uuid pk`, `userId text fk user cascade`, `cardId uuid fk cards cascade`, `externalId text unique not null`, `monthRef text not null`, `dueDate text not null` (yyyy-MM-dd), `closingDate text` (nullable), `totalAmount numeric not null`, `paidAmount numeric not null default '0'`, `hasPaymentInfo boolean not null default false`, `updatedAt timestamptz default now`.
  - `cardTransactions` + `externalId text unique`, `billExternalId text`, `purchaseDate text` (yyyy-MM-dd), `category text`. Repurposed semantics: `monthRef` = bill month, `amount` = signed per-installment value. Drop the unused `planId`.
  - `syncStatus` (`sync_status`): `id text pk` (always `"pluggy"`), `lastSuccessAt timestamptz`, `lastErrorAt timestamptz`, `lastError text`, `consentExpiresAt timestamptz`.
- Produces (types in `@/types`): `CardBill`, `SyncStatus` (as `InferSelectModel` of the tables), and an updated `Card`/`CardTransaction` to include the new columns. Prefer `InferSelectModel` over hand-written interfaces for these.

- [ ] **Step 1:** Edit the schema and types as above.
- [ ] **Step 2: Run** `npx tsc --noEmit`. Expected: errors only in code that Tasks 7–8 rewrite (`planId` usages). Fix trivial ones inline. Leave callers that Task 8 deletes.
- [ ] **Step 3: Run** `yarn db:push` and review the printed SQL. It must only add columns/tables and drop `card_transactions.plan_id`. It must **not** drop data tables. `card_transactions` is empty, so the column drop is safe.
- [ ] **Step 4: Commit** `feat(db): add tables and columns for Pluggy-synced cards`.

### Task 3: Pluggy client, mapping and sync service

**Files:**
- Create: `src/lib/pluggy/client.ts`, `src/lib/pluggy/types.ts`, `src/lib/pluggy/mapping.ts`, `src/lib/pluggy/mapping.test.ts`, `src/lib/pluggy/sync.ts`, `src/app/api/cron/pluggy-sync/route.ts`, `src/app/actions/sync.ts`, `vercel.json`
- Modify: `.env.local.example` (local only, gitignored), `src/auth.config.ts` (none needed: `/api` is already public in `authorized`; the route checks its own secret)

**Interfaces:**
- Produces `src/lib/pluggy/types.ts`: `PluggyAccount {id; type: "BANK"|"CREDIT"; name; marketingName?; number?; creditData?: {balanceDueDate?: string; balanceCloseDate?: string}}`, `PluggyBill {id; dueDate; billClosingDate?; totalAmount; payments?: {amount: number}[]}`, `PluggyTransaction {id; description; amount; date; type: "DEBIT"|"CREDIT"; category?: string|null; creditCardMetadata?: {installmentNumber?; totalInstallments?; billId?; billForecastDate?; purchaseDate?}}`, `PluggyItem {id; status; consentExpiresAt?: string|null; error?: {code: string}|null}`.
- Produces `src/lib/pluggy/client.ts` (server-only): `createPluggyClient(): Promise<PluggyClient>` with `getItem(itemId)`, `listAccounts(itemId)`, `listBills(accountId)`, `listTransactions(accountId, from: string /* yyyy-MM-dd */)`. It follows `page`/`totalPages` until done and throws `PluggyError(status, body)` on non-2xx.
- Produces `src/lib/pluggy/mapping.ts` (pure):
  - `resolveBillMonth(input: {billDueDate?: string; billForecastDate?: string; purchaseDate: string; closingDay: number|null; dueDay: number}): string`. Order: bill due date month → `billForecastDate` → derived (purchase day `< closingDay` closes this month, otherwise next month; due month = closing month, `+1` if `dueDay <= closingDay`). If `closingDay` is null, use the purchase month.
  - `isBillPayment(tx: PluggyTransaction): boolean`. True when `type === "CREDIT"` and (category matches `/credit card payment/i` or description matches `/pagamento (de fatura|recebido)|pgto fatura/i`).
  - `mapBill(bill: PluggyBill): {externalId; monthRef; dueDate; closingDate; totalAmount: string; paidAmount: string; hasPaymentInfo: boolean}`. `hasPaymentInfo = Array.isArray(payments) && payments.length > 0`.
  - `mapTransaction(tx, ctx: {billsById: Map<string, PluggyBill>; closingDay: number|null; dueDay: number}): NewCardTransactionFields | null`. Returns null for bill payments. Sign: DEBIT → `+abs`, CREDIT → `-abs`. Installment fields come from `creditCardMetadata`.
  - `deriveCardDays(bills: PluggyBill[]): {dueDay: number; closingDay: number|null} | null`, taken from the most recent bill.
  - `summarizeSync(results: {itemId: string; ok: boolean; error?: string; consentExpiresAt?: string|null}[]): {ok: boolean; error: string|null; consentExpiresAt: string|null}`. `ok` only if all items are ok. `error` joins the failed items' messages. `consentExpiresAt` = earliest.
- Produces `src/lib/pluggy/sync.ts`: `syncPluggyCards(): Promise<{ok: boolean; error: string|null}>`.
- Produces `src/app/actions/sync.ts`: `syncCardsAction(): Promise<ActionResult>`. It requires a session, calls `syncPluggyCards`, then `revalidatePath("/dashboard")`.

- [ ] **Step 1: Write failing tests** in `mapping.test.ts`:
  - `resolveBillMonth prefers bill due date`: `{billDueDate "2026-11-23T00:00:00", billForecastDate "2026-10", ...}` → `"2026-11"`.
  - `resolveBillMonth uses forecast when no bill`: → `"2026-12"` for `billForecastDate "2026-12"`.
  - `resolveBillMonth derives from closing day`: Nubank `closingDay 16, dueDay 23`. Purchase `2026-11-10` → `"2026-11"`, purchase `2026-11-20` → `"2026-12"`. Bradesco `closingDay 5, dueDay 15`, purchase `2026-11-06` → `"2026-12"`. `closingDay 28, dueDay 5`, purchase `2026-11-10` → `"2026-12"`.
  - `isBillPayment excludes payment credits`: `{type "CREDIT", description "Pagamento recebido"}` → true. A refund `{type "CREDIT", description "Estorno Amazon"}` → false.
  - `mapTransaction signs and keeps installments`: DEBIT 280 with `installmentNumber 3, totalInstallments 10, billId "b1"` (bill due `2026-11-23`) → `{amount "280", installmentCurrent 3, installmentTotal 10, monthRef "2026-11", billExternalId "b1"}`. CREDIT refund 50 → `amount "-50"`.
  - `mapBill reads payments`: payments `[{amount 1000}]` → `paidAmount "1000", hasPaymentInfo true`. No payments → `"0", false`.
  - `summarizeSync keeps going on partial failure`: one ok and one `{ok false, error "USER_AUTHORIZATION_EXPIRED"}` → `{ok false, error contains "USER_AUTHORIZATION_EXPIRED"}`, and `consentExpiresAt` is the earliest non-null value.
- [ ] **Step 2: Run** `yarn test src/lib/pluggy`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `types.ts`, `mapping.ts`, `client.ts`. The client caches the apiKey per instance (one sync = one instance).
- [ ] **Step 4: Run** `yarn test`. Expected: PASS.
- [ ] **Step 5: Implement `syncPluggyCards`.** Steps:
  1. Resolve the user by `ALLOWED_EMAIL`.
  2. For each id in `PLUGGY_ITEM_IDS`, in a try/catch per item:
     - call `getItem`; if `error`/`LOGIN_ERROR`, record a failure;
     - take accounts with `type === "CREDIT"`;
     - upsert `cards` on `pluggyAccountId`. Insert name `marketingName ?? name`, color `#8257e5`, and days from `deriveCardDays`. On update, change only `dueDay`/`closingDay`/`pluggyItemId`; never overwrite `bankName`/`color`;
     - upsert `card_bills` on `externalId`;
     - fetch transactions from the first day of the month 6 months back, map them, and upsert `card_transactions` on `externalId`;
     - delete this card's `card_transactions` whose `purchaseDate >= from` and whose `externalId` is not in the fetched set.
  3. Write `sync_status` via `summarizeSync` (upsert id `"pluggy"`; set `lastSuccessAt` when ok, otherwise `lastErrorAt`/`lastError`).
- [ ] **Step 6: Cron route.** `GET` handler. It returns 401 unless `authorization === \`Bearer ${process.env.CRON_SECRET}\``, then returns `syncPluggyCards()` as JSON (status 200 when ok, 500 otherwise). Add `vercel.json` `{"crons":[{"path":"/api/cron/pluggy-sync","schedule":"0 11 * * *"}]}` (08:00 BRT).
- [ ] **Step 7: Server action** `syncCardsAction` as specified.
- [ ] **Step 8: Run** `yarn test && npx tsc --noEmit && yarn lint`. Expected: pass.
- [ ] **Step 9: Commit** `feat(pluggy): client, mapping and daily card sync`.

### Task 4: Card bill view (real, open, forecast)

**Files:**
- Create: `src/lib/cards/bill-view.ts`, `src/lib/cards/bill-view.test.ts`

**Interfaces:**
- Consumes: `Card`, `CardBill`, `CardTransaction` types (Task 2).
- Produces:
  - `type CardBillStatus = "paid" | "paid_inferred" | "partial" | "closed" | "open" | "forecast" | "empty"`
  - `export const CARD_BILL_STATUS_LABEL: Record<Exclude<CardBillStatus,"empty">, string>` with the exact copy from Global Constraints.
  - `interface CardPurchaseView { id: string; description: string; date: string | null; amount: number; category: string; installmentCurrent?: number; installmentTotal?: number; isForecast: boolean }`
  - `interface CardBillView { card: Card; monthRef: string; status: CardBillStatus; amount: number; dueDate: string | null; purchases: CardPurchaseView[]; categories: { category: string; amount: number }[] }`
  - `buildCardBillView(input: { card: Card; bills: CardBill[]; transactions: CardTransaction[]; monthRef: string; today: Date }): CardBillView`

Rules:
- **Real month:** a bill exists with `monthRef`, or transactions exist with that `monthRef`.
  - `amount` = bill `totalAmount` if a bill exists, otherwise the sum of that month's transactions.
  - Status for a bill with `hasPaymentInfo`: `paid` if `paidAmount >= total - 0.01`, `partial` if `paidAmount > 0`, otherwise `closed`.
  - Status for a bill without payment info: `paid_inferred` if `dueDate < today`, otherwise `closed`.
  - No bill yet (only transactions): `open`.
- **Forecast month** (`monthRef` > latest real month of this card):
  - Installments come from the **latest real month only**, projected as `current + diff` while `<= total`.
  - Recurring charges are added per the Global Constraints rule, using the last 2 closed bills' transactions.
  - Status `forecast`, `dueDate` = `monthRef` + card `dueDay`, and every purchase has `isForecast: true`.
- **Otherwise** (past month with no data, or a card with no data): `status "empty"`, `amount 0`, `purchases []`.
- `categories`: sum `amount` by `category ?? "Outros"`, keep only sums > 0, sort descending.
- Description normalization for recurring detection: lowercase, strip digits and punctuation, collapse spaces.

- [ ] **Step 1: Write failing tests** with a Nubank card (`dueDay 23`, `closingDay 16`) and fixtures for Sep/Oct closed bills plus a Nov open bill:
  - `closed bill with payments is paid`: total 1000, paid 1000, `hasPaymentInfo` → `status "paid"`, `amount 1000`.
  - `closed bill without payment info past due is paid_inferred`, and `... not yet due is closed`.
  - `partial payment`: paid 300 of 1000 → `"partial"`.
  - `open month sums transactions including refunds`: 280 + 120 − 50 → `amount 350`, `"open"`.
  - `forecast projects installments from latest real month only`: installment 3/10 at 280 in Nov (open) and 2/10 in Oct (closed) → Dec forecast has exactly one item, `4/10` at 280. Feb/2027 shows `6/10`. Sep/2027 shows none from it.
  - `forecast includes recurring seen in last 2 closed bills within 10%`: "Netflix" 55.90 in Sep, 59.90 in Oct → Dec includes Netflix 59.90. "Uber" in only one bill → excluded. "Adobe" 80 vs 120 → excluded.
  - `empty past month`: `"2025-01"` → `{status "empty", amount 0, purchases []}`.
  - `card with no bills or transactions` → `"empty"` for the current month.
  - `categories aggregated and sorted`: Alimentação 300, Transporte 100, refund-only category excluded.
- [ ] **Step 2: Run** `yarn test src/lib/cards`. Expected: FAIL.
- [ ] **Step 3: Implement** `bill-view.ts`. Use date-fns (`parse`, `format`, `addMonths`, `differenceInCalendarMonths`, `isBefore`).
- [ ] **Step 4: Run** `yarn test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(cards): build per-month card bill view with forecast`.

### Task 5: Month view integration (data + totals)

**Files:**
- Create: `src/lib/month-view.ts`, `src/lib/month-view.test.ts`
- Modify: `src/lib/month-data.ts`, `src/lib/finance-logic.ts`, `src/app/actions/dashboard.ts`, `src/components/layout/header.tsx`, `src/types/index.ts`

**Interfaces:**
- Consumes: `buildCardBillView` (Task 4).
- Produces:
  - `getMonthData(userId, monthRef)` returns `{ transactions; templates; cards; cardBills; cardTransactions; syncStatus: SyncStatus | null }`. `cardTransactions` filter: `monthRef = target OR monthRef >= (current month − 3)`. `cardBills` returns all of the user's bills.
  - `type MonthData = Awaited<ReturnType<typeof getMonthData>>`
  - `buildMonthView(data: MonthData, monthRef: string, today: Date): { items: DashboardItem[]; cardBills: CardBillView[]; totals: MonthTotals }`. `totals.expense` = main expenses + the sum of `cardBills[].amount`.
  - `mergeTransactionsAndTemplates(transactions, templates, monthRef)` loses its `cards`/`cardTransactions` parameters and the whole card section (step 3 of the old function). Items with `cardId` are no longer produced.
  - `DashboardItem` drops `cardTransactions`, `cardColor`, `isCardTransaction`, `cardId`. `getCardTransactionForMonth` is deleted.
- [ ] **Step 1: Write failing tests** in `month-view.test.ts`:
  - `totals include card bills`: income template 22500, expense template 600, one card bill of 1000 → `{incoming 22500, expense 1600, total 20900}`.
  - `main items never contain cards`: no item has `id` starting with `virtual-card-`.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.** Update `finance-logic.ts`, `month-data.ts`, `month-view.ts` and `getDashboardSummaryAction` (returns `MonthData`). Update existing finance-logic tests to the new signature.
- [ ] **Step 4: Header.** Replace the four `useState`s with one `MonthData | null`, and compute totals with `buildMonthView(data, monthRef, new Date()).totals`.
- [ ] **Step 5: Run** `yarn test && npx tsc --noEmit`. Expected: tests pass. Type errors remain only in files Task 6 rewrites (`expense-modal`, `edit-bill-modal`, `transaction-item`, `dashboard-view`, `actions/transactions`, `actions/cards`, `cards/*`).
- [ ] **Step 6: Commit** `refactor: build month view with card bills outside the main list`.

### Task 6: Remove manual card flows

**Files:**
- Delete: `src/components/dashboard/edit-bill-modal.tsx` (owner already authorized dropping the manual card feature)
- Modify: `src/components/dashboard/expense-modal.tsx` (remove the card select, `userCards` prop, card installment branch A and the card create branch), `src/components/dashboard/transaction-item.tsx` (remove the sub-item list and card color), `src/app/actions/transactions.ts` (remove `isCardTx` and the `cardTransactions` branches), `src/app/actions/cards.ts` (keep only `updateCardAction(id, {bankName, color})`), `src/components/cards/card-form.tsx` (fields: name + color only), `src/app/(dashboard)/cards/card-manager.tsx` (no create/delete; edit only; empty state "Nenhum cartão sincronizado ainda. Os cartões aparecem após a primeira sincronização com a Pluggy."), `src/app/(dashboard)/dashboard-view.tsx` (drop the bill modal, the virtual-card paid branch and the `isCardTransaction` delete branch), `src/types/index.ts` (drop `CreateCardPayload` fields beyond `bankName`/`color`)

**Interfaces:**
- Produces: `updateCardAction(id: string, payload: { bankName: string; color: string }): Promise<ActionResult>`

- [ ] **Step 1:** Make the edits. Expense modal installments (no card) keep creating a template exactly as today.
- [ ] **Step 2: Run** `npx tsc --noEmit && yarn lint && yarn test && yarn build`. Expected: all pass, no references to `EditBillModal`, `isCardTransaction` or `createCardAction` (`grep -rn` returns nothing).
- [ ] **Step 3: Commit** `refactor: remove manual card bills and card purchases`.

### Task 7: Cards section UI

**Files:**
- Create: `src/components/cards/card-bills-section.tsx`, `src/components/cards/card-bill-item.tsx`, `src/components/cards/category-chart.tsx`, `src/components/cards/card-purchase-list.tsx`, `src/components/cards/sync-status-bar.tsx`
- Modify: `src/app/(dashboard)/dashboard-view.tsx` (use `buildMonthView`, render `<CardBillsSection>` between the toolbar and `<TransactionList>`), `src/app/(dashboard)/dashboard/page.tsx` (pass `MonthData`), `src/app/(dashboard)/dashboard-view.tsx` props → `{ initialMonthRef: string; monthData: MonthData }`

**Interfaces:**
- Consumes: `CardBillView`, `CARD_BILL_STATUS_LABEL` (Task 4); `MonthData`, `buildMonthView` (Task 5); `syncCardsAction` (Task 3).
- Produces: `CardBillsSection({ bills: CardBillView[]; syncStatus: SyncStatus | null })`.

Behavior:
- Section title "Cartões". There is one row per card: color dot, name, status badge, "Vence dia DD", and the amount in BRL. Clicking expands it.
- **Expanded:** `CategoryChart` uses horizontal bars, max 6 categories plus "Outros", with percentage and value. Before writing chart code, load the `dataviz` skill. Below the chart, `CardPurchaseList` has columns Descrição / Data / Categoria / Valor, `3/10` when installment, and a "previsto" tag plus muted style for forecast items.
- Status badge colors: paid/paid_inferred green `#00b37e`, partial/closed amber, open blue-ish neutral, forecast zinc dashed border.
- **Empty states:**
  - no cards: "Nenhum cartão sincronizado." with the sync button;
  - status `empty`: the row shows "Sem fatura neste mês" and is not expandable.
- `SyncStatusBar`: "Atualizado em dd/MM às HH:mm" (from `lastSuccessAt`, `date-fns` `ptBR`) and a "Sincronizar agora" button. The button calls `syncCardsAction`, shows a loading state, toasts success or error via `sonner`, and then runs `router.refresh()`.
  - If `lastError` is newer than `lastSuccessAt`, show a red warning: "Falha na última sincronização: <erro>".
  - If `consentExpiresAt` is within 30 days, show an amber warning: "Autorização da Pluggy expira em <data>. Reautorize em dashboard.pluggy.ai."
- `formatCurrency`: reuse a single helper. Move the one in `summary-cards.tsx` to `src/lib/format.ts` (`formatCurrency(value: number): string`) and import it everywhere it is duplicated in touched files.

- [ ] **Step 1:** Implement the components and wire up `dashboard-view`/`page`.
- [ ] **Step 2: Run** `npx tsc --noEmit && yarn lint && yarn test && yarn build`. Expected: pass.
- [ ] **Step 3: Visual check:** run `yarn dev`, open `/dashboard` and the cards section. Check the empty state before the first sync, then expand after the sync (Task 8). Screenshot for the owner.
- [ ] **Step 4: Commit** `feat(cards): cards section with category chart and purchase list`.

### Task 8: Credentials, data cleanup, first sync, ship

**Files:**
- Create: `scripts/cleanup-legacy-card-data.mjs` (one-off; committed for traceability)
- Modify: `.env` (only appending the Pluggy/CRON keys; confirm with the owner before writing), Vercel envs

**Interfaces:**
- Consumes: `syncPluggyCards` via the cron route or `syncCardsAction`.

- [ ] **Step 1: Owner provides credentials.** The owner runs, in this session:
  `! printf '\nPLUGGY_CLIENT_ID=...\nPLUGGY_CLIENT_SECRET=...\nPLUGGY_ITEM_IDS=id1,id2,id3\n' >> .env`
  The secret is never pasted into chat. The builder generates `CRON_SECRET` with `openssl rand -hex 32`, appends it to `.env`, and adds all four keys to Vercel (production, preview, development) with `vercel env add`, piping the values from `.env` without echoing them.
- [ ] **Step 2: Backup.** The script's `--backup` mode writes a JSON dump of `cards`, `transactions` and `recurring_templates` to the session scratchpad path, passed as an argument. Run it and confirm the file exists with row counts (3 / ~110 / 23).
- [ ] **Step 3: First sync locally:** `yarn dev`, then `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/pluggy-sync`. Expected: `{ok: true}`, 3 new cards with `pluggy_account_id`, and bills plus transactions present. If a bank returns no CREDIT account, stop and report.
- [ ] **Step 4: Cleanup.** The script's `--apply` mode runs in one transaction:
  - `delete from transactions;`
  - `delete from recurring_templates where card_id is not null;`
  - `delete from cards where pluggy_account_id is null;`

  Print the counts.
- [ ] **Step 5: Verify data:**
  - 12 expense templates without cards plus "Dasa" and "Fastback" remain;
  - `/dashboard?month=2026-11` shows Fastback 10/18 at R$ 2.800;
  - the cards section shows 3 cards with real values that match the bank apps (ask the owner to compare one bill).
- [ ] **Step 6: Commit** the script plus any fixes, then follow the owner's "sobe tudo" flow if requested: code review, merge, push, Vercel deploy, then trigger the production cron once with `curl` and confirm `sync_status.last_success_at` updates.
