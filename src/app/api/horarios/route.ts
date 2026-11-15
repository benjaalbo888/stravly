import { addDays, BOOKING_DAYS, santiagoDate } from "@/lib/schedule";
import { dataClient } from "@/lib/supabase/server";
import { isDate, isUuid } from "@/lib/validation";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const service = params.get("servicio") ?? "";
  const date = params.get("fecha") ?? "";
  const today = santiagoDate();
  const headers = { "Cache-Control": "no-store" };
  if (!isUuid(service) || !isDate(date) || date < today || date > addDays(today, BOOKING_DAYS)) {
    return Response.json({ error: "Elige un servicio y una fecha válidos." }, { status: 400, headers });
  }
  const client = dataClient();
  const result = await client?.rpc("stravly_slots", { p_service: service, p_date: date });
  if (!result || result.error) return Response.json({ error: "No pudimos cargar los horarios. Intenta nuevamente." }, { status: 503, headers });
  return Response.json({ slots: (result.data as { starts_at: string }[]).map((r) => r.starts_at) }, { headers });
}
