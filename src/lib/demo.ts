import "server-only";

import type { Catalog, Service } from "./models";
import { addDays, santiagoDate, timeLabel } from "./schedule";
import { isDate } from "./validation";

export const demoServices: Service[] = [
  { id: "00000000-0000-4000-8000-000000000001", name: "Corte de pelo", description: "Asesoría, corte y terminación", duration_minutes: 30, price_clp: 14000, active: true },
  { id: "00000000-0000-4000-8000-000000000002", name: "Perfilado de barba", description: "Perfilado y acabado con toalla caliente", duration_minutes: 30, price_clp: 10000, active: true },
  { id: "00000000-0000-4000-8000-000000000003", name: "Corte y barba", description: "Corte y perfilado en la misma visita", duration_minutes: 60, price_clp: 21000, active: true },
];

export const demoWorkers: Catalog["workers"] = [
  { id: 1, name: "Camila Ríos", description: "Cortes clásicos y degradados", photo_url: "", active: true, services: demoServices.map(({ id }) => id) },
  { id: 2, name: "Martín Vega", description: "Cortes y perfilado de barba", photo_url: "", active: true, services: demoServices.map(({ id }) => id) },
];

export function demoDates(now = new Date()) {
  const tomorrow = addDays(santiagoDate(now), 1);
  return {
    first: new Date(`${tomorrow}T12:00:00Z`).getUTCDay() === 0 ? addDays(tomorrow, 1) : tomorrow,
    last: addDays(tomorrow, 14),
  };
}

export function demoAvailability(serviceId: string, worker: string, date: string, now = new Date()) {
  const slots = new Map<string, string>();
  const service = demoServices.find(({ id }) => id === serviceId);
  const { first, last } = demoDates(now);
  if (!service || !isDate(date) || date < first || date > last || new Date(`${date}T12:00:00Z`).getUTCDay() === 0) return slots;

  // The example works during the day, away from Santiago's midnight clock changes.
  const utcMidnight = Date.parse(`${date}T00:00:00Z`);
  const [hour, minute] = timeLabel(`${date}T12:00:00Z`).split(":").map(Number);
  const offset = 12 * 60 - (hour * 60 + minute);
  for (const person of demoWorkers) {
    if ((worker !== "any" && worker !== String(person.id)) || !person.services.includes(serviceId)) continue;
    const opens = person.id === 1 ? 10 * 60 : 11 * 60;
    const closes = person.id === 1 ? 17 * 60 + 30 : 19 * 60;
    for (let start = opens; start + service.duration_minutes <= closes; start += 30) {
      const instant = new Date(utcMidnight + (start + offset) * 60_000).toISOString();
      if (!slots.has(instant)) slots.set(instant, person.name);
    }
  }
  return slots;
}
