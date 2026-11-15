import { notFound } from "next/navigation";
import { Footer, Header } from "@/components/brand";
import { dataClient } from "@/lib/supabase/server";
import { bookingConfig } from "@/lib/supabase/env";
import { addDays, BOOKING_DAYS, santiagoDate } from "@/lib/schedule";
import { isSlug } from "@/lib/validation";
import type { Catalog } from "@/lib/models";
import { BookingForm } from "@/app/reservar/booking-form";

export const dynamic = "force-dynamic";

export default async function PublicBusiness({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isSlug(slug)) notFound();
  const result = await dataClient()?.rpc("business_catalog", { p_slug: slug });
  const catalog = result?.data as Catalog | null | undefined;
  if (result && !result.error && !catalog) notFound();
  const today = santiagoDate();
  const business = catalog?.business;
  return <><Header /><main id="contenido" className="workspace"><div className="shell stack">
    <div className="page-intro">
      <p className="eyebrow">{business?.category ?? "RESERVAS ONLINE"}</p>
      <h1>{business?.name ?? "Agenda del negocio"}</h1>
      <p>{business?.description || "Elige un servicio, un profesional y un horario."}</p>
      {business && <p>{[business.location, business.phone, business.email].filter(Boolean).join(" · ")}</p>}
    </div>
    {!catalog || !bookingConfig() ? <p className="notice">La agenda no está disponible en este momento.</p>
      : !catalog.services.length ? <p className="notice">Este negocio todavía no tiene servicios disponibles.</p>
      : <BookingForm slug={slug} services={catalog.services} workers={catalog.workers} today={today} lastDay={addDays(today, BOOKING_DAYS)} />}
  </div></main><Footer /></>;
}
