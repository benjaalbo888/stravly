import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/manrope";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Stravly · Reservas online", template: "%s · Stravly" },
  description: "Elige un servicio, encuentra un horario disponible y reserva una cita en pocos pasos.",
  applicationName: "Stravly",
  openGraph: { title: "Stravly · Reservas online", description: "Tu tiempo, mejor organizado.", locale: "es_CL", type: "website" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es-CL"><body><a className="skip-link" href="#contenido">Saltar al contenido</a>{children}</body></html>;
}
