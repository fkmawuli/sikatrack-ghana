import { formatInTimeZone, toZonedTime } from "date-fns-tz";

export const GHANA_TZ = "Africa/Accra";

/** DD/MM/YYYY */
export function formatDate(date: Date | string): string {
  return formatInTimeZone(new Date(date), GHANA_TZ, "dd/MM/yyyy");
}

/** DD/MM/YYYY, HH:mm */
export function formatDateTime(date: Date | string): string {
  return formatInTimeZone(new Date(date), GHANA_TZ, "dd/MM/yyyy, HH:mm");
}

export function formatTime(date: Date | string): string {
  return formatInTimeZone(new Date(date), GHANA_TZ, "HH:mm");
}

/** Current date/time as seen in Africa/Accra */
export function nowInGhana(): Date {
  return toZonedTime(new Date(), GHANA_TZ);
}

/** Start of "today" in Ghana time, expressed as a UTC Date usable in DB queries */
export function startOfTodayGhana(): Date {
  const zoned = toZonedTime(new Date(), GHANA_TZ);
  zoned.setHours(0, 0, 0, 0);
  return zoned;
}

export function startOfYesterdayGhana(): Date {
  const start = startOfTodayGhana();
  start.setDate(start.getDate() - 1);
  return start;
}

export function daysAgoGhana(days: number): Date {
  const start = startOfTodayGhana();
  start.setDate(start.getDate() - days);
  return start;
}
