import { Header } from "@/components/brand";

export default function Loading() {
  return <><Header /><main className="workspace" id="contenido"><div className="shell">
    <p className="eyebrow">AGENDA ONLINE</p><h1>Reserva tu próxima cita.</h1>
    <p className="notice mt-5" role="status">Cargando servicios…</p>
  </div></main></>;
}
