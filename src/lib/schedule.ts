export const TIME_ZONE = "America/Santiago";
export const BOOKING_DAYS = 60;

export function santiagoDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addDays(date: string, days: number) {
  const utc = new Date(`${date}T12:00:00Z`);
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export function dateLabel(date: string, weekday = false) {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "UTC", ...(weekday ? { weekday: "long" } : {}), day: "numeric", month: "long",
  }).format(new Date(`${date}T12:00:00Z`));
}

export const timeLabel = (instant: string) => new Intl.DateTimeFormat("es-CL", {
  timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
}).format(new Date(instant));

export const money = (value: number) => new Intl.NumberFormat("es-CL", {
  style: "currency", currency: "CLP", maximumFractionDigits: 0,
}).format(value);
