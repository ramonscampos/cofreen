import { differenceInDays } from "date-fns";
import { getTodayInSaoPaulo } from "@/lib/dates";

const CONSENT_WARNING_DAYS = 30;

export function getConsentNotice(
  consentExpiresAt: string | null | undefined,
  now: Date,
): { expired: boolean; date: string } | null {
  if (!consentExpiresAt) return null;
  const expires = new Date(consentExpiresAt);
  if (differenceInDays(expires, now) > CONSENT_WARNING_DAYS) return null;
  const [year, month, day] = getTodayInSaoPaulo(expires).split("-");
  return { expired: expires <= now, date: `${day}/${month}/${year}` };
}
