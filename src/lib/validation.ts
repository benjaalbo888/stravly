export const isUuid = (value: string) => /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);

export function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
}

export function isClock(value: string) {
  return /^(?:[01]\d|2[0-3]):(?:00|15|30|45)$/.test(value);
}

export function field(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function integer(value: string, min: number, max: number) {
  if (!/^\d{1,8}$/.test(value)) return undefined;
  const n = Number(value);
  return n >= min && n <= max ? n : undefined;
}

export const isEmail = (value: string) => value.length <= 160 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export function bookingInput(form: FormData) {
  const service = field(form, "service");
  const start = field(form, "start");
  const name = field(form, "name");
  const email = field(form, "email").toLowerCase();
  const phone = field(form, "phone").replace(/[ ().-]/g, "");
  if (!isUuid(service) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(start) ||
      !isDate(start.slice(0, 10)) || !Number.isFinite(Date.parse(start)) ||
      name.length < 2 || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name) ||
      !isEmail(email) || !/^\+?\d{8,15}$/.test(phone)) return null;
  return { service, start, name, email, phone };
}
