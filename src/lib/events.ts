export const TRANSACTION_UPDATED_EVENT = "transaction-updated";

export function triggerTransactionUpdate() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(TRANSACTION_UPDATED_EVENT));
  }
}
