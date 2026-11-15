"use server";

import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { headers } from "next/headers";
import { bookingConfig } from "@/lib/supabase/env";
import { dataClient } from "@/lib/supabase/server";
import { bookingInput, field } from "@/lib/validation";
import type { BookingState } from "@/lib/models";

export async function reserve(_: BookingState, form: FormData): Promise<BookingState> {
  if (field(form, "website")) return { error: "No pudimos procesar la solicitud." };
  const input = bookingInput(form);
  if (!input) return { error: "Revisa el servicio, el horario y tus datos de contacto." };
  const config = bookingConfig();
  if (!config) return { error: "Las reservas no están disponibles en este momento." };
  const forwarded = process.env.VERCEL === "1" ? (await headers()).get("x-vercel-forwarded-for")?.split(",")[0]?.trim() : null;
  const ip = forwarded && isIP(forwarded) ? forwarded : "unavailable";
  const clientHash = createHmac("sha256", config.key).update(`stravly-booking:${ip}`).digest("hex");
  const response = await dataClient(config)?.rpc("stravly_book", {
    p_service: input.service, p_start: input.start, p_name: input.name, p_email: input.email,
    p_phone: input.phone, p_client_hash: clientHash,
  });
  const result = response?.data;
  if (!response || response.error || !result) return { error: "No pudimos confirmar la cita. Intenta nuevamente." };
  if (result.status === "confirmed") return { confirmed: result };
  if (result.status === "unavailable") return { error: "Ese horario dejó de estar disponible. Elige otro.", retrySlots: true };
  if (result.status === "limited") return { error: "Hubo demasiados intentos. Vuelve a intentarlo más tarde." };
  return { error: "Revisa tus datos e intenta nuevamente." };
}
