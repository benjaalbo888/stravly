"use server";

import { createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { headers } from "next/headers";
import { demoAvailability, demoServices } from "@/lib/demo";
import { bookingConfig } from "@/lib/supabase/env";
import { dataClient } from "@/lib/supabase/server";
import { bookingInput, field, isSlug, workerId } from "@/lib/validation";
import type { BookingState } from "@/lib/models";

export async function reserveDemo(form: FormData): Promise<BookingState> {
  const serviceId = field(form, "service");
  const startsAt = field(form, "start");
  const service = demoServices.find(({ id }) => id === serviceId);
  const worker = demoAvailability(serviceId, field(form, "worker"), field(form, "date")).get(startsAt);
  if (!service || !worker) return { error: "Elige un horario disponible de la demo.", retrySlots: true };
  return { confirmed: { status: "confirmed", code: `DEMO-${randomBytes(4).toString("hex").toUpperCase()}`,
    service: service.name, worker, startsAt, duration: service.duration_minutes, price: service.price_clp } };
}

export async function reserve(slug: string | null, _: BookingState, form: FormData): Promise<BookingState> {
  const multi = process.env.STRAVLY_MULTI_BUSINESS === "1";
  if (Boolean(slug) !== multi) return { error: "Esta agenda no está disponible. Abre el enlace de reservas del negocio." };
  if (field(form, "website")) return { error: "No pudimos procesar la solicitud." };
  const input = bookingInput(form);
  if (!input) return { error: "Revisa el servicio, el horario y tus datos de contacto." };
  const config = bookingConfig();
  if (!config) return { error: "Las reservas no están disponibles en este momento." };
  const forwarded = process.env.VERCEL === "1" ? (await headers()).get("x-vercel-forwarded-for")?.split(",")[0]?.trim() : null;
  const ip = forwarded && isIP(forwarded) ? forwarded : "unavailable";
  const clientHash = createHmac("sha256", config.key).update(`stravly-booking:${ip}`).digest("hex");
  const professional = field(form, "worker");
  if (slug && (!isSlug(slug) || (professional !== "any" && workerId(professional) === null))) return { error: "Selecciona un profesional." };
  const response = await dataClient(config)?.rpc(slug ? "book_business" : "stravly_book", {
    p_service: input.service, p_start: input.start, p_name: input.name, p_email: input.email,
    p_phone: input.phone, p_client_hash: clientHash,
    ...(slug ? { p_slug: slug, p_worker: workerId(professional) } : {}),
  });
  const result = response?.data;
  if (!response || response.error || !result) return { error: "No pudimos confirmar la cita. Intenta nuevamente." };
  if (result.status === "confirmed") return { confirmed: result };
  if (result.status === "unavailable") return { error: "Ese horario dejó de estar disponible. Elige otro.", retrySlots: true };
  if (result.status === "limited") return { error: "Hubo demasiados intentos. Vuelve a intentarlo más tarde." };
  return { error: "Revisa tus datos e intenta nuevamente." };
}
