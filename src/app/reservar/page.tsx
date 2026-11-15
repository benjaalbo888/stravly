import type { Metadata } from "next";
import { Footer, Header } from "@/components/brand";
import { bookingConfig } from "@/lib/supabase/env";
import { dataClient } from "@/lib/supabase/server";
import { addDays, BOOKING_DAYS, santiagoDate } from "@/lib/schedule";
import type { Service } from "@/lib/models";
import { BookingForm } from "./booking-form";

export const metadata: Metadata = { title: "Reservar una cita" };
export const dynamic = "force-dynamic";

export default async function BookingPage() {
  const client = bookingConfig() ? dataClient() : null;
  const [business, services] = client ? await Promise.all([
    client.from("business").select("name").single(),
    client.from("services").select("id,name,description,duration_minutes,price_clp,active").eq("active", true).order("price_clp"),
  ]) : [];
  const ready = business?.data && services?.data;
  const today = santiagoDate();

  return <><Header /><main className="workspace" id="contenido"><div className="shell">
    <div className="page-intro"><p className="eyebrow">{business?.data?.name ?? "AGENDA ONLINE"}</p>
      <h1>Reserva tu próxima cita.</h1><p>Elige un servicio y un horario. Te daremos un código cuando tu cita quede confirmada.</p></div>
    {ready ? services.data.length ? <BookingForm services={services.data as Service[]} today={today} lastDay={addDays(today, BOOKING_DAYS)} />
      : <p className="notice" role="status">Todavía no hay servicios disponibles para reservar.</p>
      : <p className="notice" role="status">La agenda no está disponible en este momento. Intenta más tarde.</p>}
  </div></main><Footer /></>;
}
