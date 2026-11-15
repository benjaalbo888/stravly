import type { Metadata } from "next";
import { Scissors } from "lucide-react";
import { Footer, Header } from "@/components/brand";
import { demoDates, demoServices, demoWorkers } from "@/lib/demo";
import { BookingForm } from "@/app/reservar/booking-form";

export const metadata: Metadata = { title: "Barbería Demo", description: "Prueba una reserva con un negocio ficticio, sin cuenta ni datos personales." };
export const dynamic = "force-dynamic";

export default function DemoPage() {
  const { first, last } = demoDates();

  return <><Header /><main id="contenido" className="workspace booking-workspace"><div className="shell stack">
    <div className="booking-masthead">
      <span className="booking-emblem" aria-hidden="true"><Scissors size={27} /></span>
      <div><p className="eyebrow">DEMO INTERACTIVA</p><h1>Barbería Demo</h1>
        <p>Elige un servicio, compara horarios entre dos profesionales y confirma una cita de prueba.</p></div>
    </div>
    <p className="notice demo-notice">Negocio ficticio. Puedes completar el flujo sin cuenta ni datos personales.</p>
    <BookingForm demo services={demoServices} workers={demoWorkers} today={first} lastDay={last} />
  </div></main><Footer /></>;
}
