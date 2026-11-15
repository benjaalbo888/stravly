import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/manrope";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Stravly · Reservas online", template: "%s · Stravly" },
  description: "Agenda online para barberías y otros negocios. Gestiona los horarios de tu equipo y recibe citas desde tu propio enlace.",
  applicationName: "Stravly",
  other: { "page-type": "software", "site-kind": "software" },
  openGraph: { title: "Stravly · Reservas online", description: "Organiza las agendas de tu equipo y ofrece reservas online desde un enlace.", locale: "es_CL", type: "website" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es-CL" data-type="software"><body><a className="skip-link" href="#contenido">Saltar al contenido</a>{children}</body></html>;
}
