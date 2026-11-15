import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Clock3, LogOut, Scissors } from "lucide-react";
import { Footer, Header } from "@/components/brand";
import { addDays, dateLabel, money, santiagoDate, timeLabel } from "@/lib/schedule";
import { adminClient } from "@/lib/supabase/server";
import { integer, isDate } from "@/lib/validation";
import type { Block, Booking, Hours, Service } from "@/lib/models";
import { AdminForm } from "./admin-form";
import { addBlock, cancelBooking, removeBlock, saveHours, saveService, signOut } from "./actions";

export const metadata: Metadata = { title: "Panel de administración", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Client = NonNullable<Awaited<ReturnType<typeof adminClient>>>;
type Query = Record<string, string | string[] | undefined>;
const weekdays = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const pageSize = 25;
const first = (value: Query[string]) => typeof value === "string" ? value : "";

export default async function AdminPage({ searchParams }: { searchParams: Promise<Query> }) {
  const client = await adminClient();
  if (!client) redirect("/admin/login");
  const query = await searchParams;
  const section = ["servicios", "horarios"].includes(first(query.seccion)) ? first(query.seccion) : "agenda";

  return <><Header /><main className="workspace" id="contenido"><div className="shell">
    <div className="page-intro admin-top"><div><p className="eyebrow">PANEL PRIVADO</p><h1>Panel de administración</h1>
      <p className="muted mt-2">Gestiona la agenda y la disponibilidad del negocio.</p></div>
      <form action={signOut}><button className="button button-quiet"><LogOut size={16} aria-hidden="true" /> Cerrar sesión</button></form>
    </div>
    {query.sesion === "error" && <p className="notice error mb-4" role="alert">No pudimos cerrar la sesión. Inténtalo de nuevo.</p>}
    <nav className="admin-tabs" aria-label="Secciones del panel">
      {[["agenda", "Agenda"], ["servicios", "Servicios"], ["horarios", "Horarios y bloqueos"]].map(([value, label]) =>
        <Link key={value} href={value === "agenda" ? "/admin" : `/admin?seccion=${value}`}
          className="button button-quiet" aria-current={value === section ? "page" : undefined}>{label}</Link>)}
    </nav>
    {section === "servicios" ? <Services client={client} /> : section === "horarios" ? <Schedule client={client} /> : <Agenda client={client} query={query} />}
  </div></main><Footer /></>;
}

async function Agenda({ client, query }: { client: Client; query: Query }) {
  const today = santiagoDate();
  const dateParam = first(query.fecha);
  const date = isDate(dateParam) && dateParam >= "2000-01-01" && dateParam <= "2100-12-31" ? dateParam : today;
  const upcoming = query.vista === "proximas";
  const page = integer(first(query.pagina), 1, 10000) ?? 1;
  const [currentBounds, selectedBounds] = await Promise.all([
    client.rpc("stravly_day_bounds", { p_date: today }).single<{ day_start: string; day_end: string }>(),
    date === today ? null : client.rpc("stravly_day_bounds", { p_date: date }).single<{ day_start: string; day_end: string }>(),
  ]);
  const current = currentBounds.data;
  const selected = selectedBounds ? selectedBounds.data : current;
  if (!current || !selected) return <p className="notice error" role="alert">No pudimos cargar la agenda. Actualiza la página.</p>;
  const now = new Date().toISOString();
  const start = (page - 1) * pageSize;
  const bookings = client.from("bookings").select("id,code,service_name,price_clp,starts_at,ends_at,customer_name,customer_email,customer_phone,status", { count: "exact" });
  const filtered = upcoming ? bookings.eq("status", "confirmed").gte("starts_at", now)
    : bookings.gte("starts_at", selected.day_start).lt("starts_at", selected.day_end);
  const [todayCount, upcomingCount, allCount, appointments] = await Promise.all([
    client.from("bookings").select("id", { count: "exact", head: true }).eq("status", "confirmed").gte("starts_at", current.day_start).lt("starts_at", current.day_end),
    client.from("bookings").select("id", { count: "exact", head: true }).eq("status", "confirmed").gte("starts_at", now),
    client.from("bookings").select("id", { count: "exact", head: true }),
    filtered.order("starts_at").order("id").range(start, start + pageSize - 1),
  ]);
  const results = (appointments.data ?? []) as Booking[];
  const listUrl = upcoming ? "/admin?vista=proximas" : `/admin?fecha=${date}`;

  return <div className="stack">
    <dl className="stat-grid">
      {([["Reservas de hoy", todayCount.count], ["Reservas próximas", upcomingCount.count], ["Total histórico", allCount.count]] as const)
        .map(([label, amount]) => <div className="card" key={label}><dt>{label}</dt><dd>{amount ?? "—"}</dd></div>)}
    </dl>
    <section className="card stack">
      <div className="card-title !mb-0"><CalendarDays aria-hidden="true" size={21} /><h2>Agenda</h2></div>
      <div className="date-strip" aria-label="Siguientes siete días">
        {Array.from({ length: 7 }, (_, offset) => addDays(today, offset)).map((day, index) =>
          <Link key={day} className="date-chip" href={`/admin?fecha=${day}`} aria-current={!upcoming && day === date ? "date" : undefined}
            aria-label={dateLabel(day, true)}><span>{index === 0 ? "Hoy" : dateLabel(day, true).split(" ")[0]}</span><strong>{day.slice(8)}</strong></Link>)}
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        <form action="/admin" className="flex flex-wrap gap-2 items-end">
          <label className="field">Filtrar por fecha<input name="fecha" type="date" key={date} defaultValue={date} min="2000-01-01" max="2100-12-31" required /></label>
          <button className="button button-quiet">Ver fecha</button>
        </form>
        <Link className="button button-quiet" href={upcoming ? "/admin" : "/admin?vista=proximas"}>{upcoming ? "Ver reservas de hoy" : "Ver todas las próximas"}</Link>
      </div>
      <h3 className="text-lg capitalize">{upcoming ? "Próximas citas" : dateLabel(date, true)}</h3>
      {appointments.error && appointments.error.code !== "PGRST103" ? <p className="notice error" role="alert">No pudimos cargar las citas.</p>
        : results.length === 0 ? <p className="notice">No hay citas en esta vista.</p>
        : <div className="table-scroll" tabIndex={0} role="region" aria-label="Tabla de citas"><table>
            <thead><tr><th scope="col">Fecha y hora</th><th scope="col">Servicio</th><th scope="col">Cliente</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead>
            <tbody>{results.map((item) => <tr key={item.id}>
              <td className="whitespace-nowrap">{dateLabel(santiagoDate(new Date(item.starts_at)))}<br />{timeLabel(item.starts_at)}–{timeLabel(item.ends_at)}</td>
              <td><strong>{item.service_name}</strong><br /><span className="muted">{item.code}</span></td>
              <td><strong>{item.customer_name}</strong><br />{item.customer_email}<br />{item.customer_phone}</td>
              <td><span className={`badge ${item.status === "cancelled" ? "inactive" : ""}`}>{item.status === "confirmed" ? "Confirmada" : "Cancelada"}</span></td>
              <td>{item.status === "confirmed" && Date.parse(item.starts_at) > Date.parse(now) ? <AdminForm action={cancelBooking} submit="Cancelar cita"
                compact danger confirm={`¿Cancelar la reserva ${item.code}?`}><input type="hidden" name="id" value={item.id} /></AdminForm> : "—"}</td>
            </tr>)}</tbody>
          </table></div>}
      {(page > 1 || (appointments.count ?? 0) > pageSize) && <nav className="flex items-center gap-2" aria-label="Páginas de la agenda">
        {page > 1 && <Link className="button button-quiet button-small" href={`${listUrl}&pagina=${page - 1}`}>Anterior</Link>}
        <span>Página {page}</span>
        {(appointments.count ?? 0) > start + pageSize && <Link className="button button-quiet button-small" href={`${listUrl}&pagina=${page + 1}`}>Siguiente</Link>}
      </nav>}
    </section>
  </div>;
}

async function Services({ client }: { client: Client }) {
  const { data, error } = await client.from("services").select("id,name,description,duration_minutes,price_clp,active").order("name");
  return <div className="two-columns">
    <section className="card stack">
      <div className="card-title !mb-0"><Scissors size={21} aria-hidden="true" /><h2>Servicios del negocio</h2></div>
      {error ? <p className="notice error" role="alert">No pudimos cargar los servicios.</p>
        : !data?.length ? <p className="notice">Todavía no hay servicios.</p>
        : (data as Service[]).map((service) => <details className="admin-detail" key={service.id}>
          <summary>{service.name} <span className={`badge ${service.active ? "" : "inactive"}`}>{service.active ? "Visible" : "Desactivado"}</span>
            <span className="muted block text-xs font-normal">{service.duration_minutes} min · {money(service.price_clp)}</span></summary>
          <ServiceFields service={service} />
        </details>)}
    </section>
    <section className="card stack"><h2>Nuevo servicio</h2><ServiceFields /></section>
  </div>;
}

function ServiceFields({ service }: { service?: Service }) {
  return <AdminForm action={saveService} submit={service ? "Guardar servicio" : "Crear servicio"}>
    {service && <input type="hidden" name="id" value={service.id} />}
    <label className="field">Nombre del servicio<input name="name" required minLength={2} maxLength={80} defaultValue={service?.name} /></label>
    <label className="field">Descripción<textarea name="description" rows={2} maxLength={240} defaultValue={service?.description} /></label>
    <div className="field-pair">
      <label className="field">Duración (min)<input type="number" name="duration" min={15} max={180} step={15} defaultValue={service?.duration_minutes ?? 30} required /></label>
      <label className="field">Precio (CLP)<input type="number" name="price" min={0} max={1000000} defaultValue={service?.price_clp ?? 0} required /></label>
    </div>
    <label className="field !flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={service?.active ?? true} />Visible para reservas</label>
  </AdminForm>;
}

async function Schedule({ client }: { client: Client }) {
  const today = santiagoDate();
  const [hours, blocks] = await Promise.all([
    client.from("working_hours").select("weekday,opens_at,closes_at,active").order("weekday"),
    client.from("blocks").select("id,starts_at,ends_at,reason").gt("ends_at", new Date().toISOString()).order("starts_at"),
  ]);
  return <div className="two-columns">
    <section className="card stack">
      <div className="card-title !mb-0"><Clock3 size={21} aria-hidden="true" /><h2>Horario semanal</h2></div>
      <p className="muted">Los nuevos horarios se aplican a futuras reservas. Las citas ya confirmadas se conservan.</p>
      {hours.error ? <p className="notice error" role="alert">No pudimos cargar el horario.</p> : <AdminForm action={saveHours} submit="Guardar horarios">
        {weekdays.map((name, index) => {
          const day = index + 1;
          const item = (hours.data as Hours[]).find((row) => row.weekday === day);
          return <fieldset className="admin-detail" key={day}>
            <legend className="font-bold">{name}</legend>
            <div className="field-pair">
              <label className="field">Apertura<input type="time" name={`from-${day}`} step={900} defaultValue={item?.opens_at.slice(0, 5) ?? "10:00"} required /></label>
              <label className="field">Cierre<input type="time" name={`to-${day}`} step={900} defaultValue={item?.closes_at.slice(0, 5) ?? "19:00"} required /></label>
            </div>
            <label className="field !flex items-center gap-2 mt-2"><input type="checkbox" name={`active-${day}`} defaultChecked={item?.active ?? false} />Abierto</label>
          </fieldset>;
        })}
      </AdminForm>}
    </section>
    <section className="card stack">
      <h2>Bloqueos de la agenda</h2>
      <p className="muted">Deja ambas horas vacías para bloquear el día completo.</p>
      <AdminForm action={addBlock} submit="Crear bloqueo">
        <label className="field">Fecha del bloqueo<input type="date" name="date" min={today} max={addDays(today, 366)} required /></label>
        <div className="field-pair"><label className="field">Desde<input type="time" name="from" step={900}/></label>
          <label className="field">Hasta<input type="time" name="to" step={900}/></label></div>
        <label className="field">Motivo interno<input name="reason" maxLength={100} /></label>
      </AdminForm>
      {blocks.error ? <p className="notice error" role="alert">No pudimos cargar los bloqueos.</p>
        : !blocks.data?.length ? <p className="notice">No hay bloqueos vigentes.</p>
        : (blocks.data as Block[]).map((block) => <div key={block.id} className="admin-detail stack">
          <div><strong>{dateLabel(santiagoDate(new Date(block.starts_at)))} · {timeLabel(block.starts_at)} ↔ {dateLabel(santiagoDate(new Date(block.ends_at)))} · {timeLabel(block.ends_at)}</strong>
            {block.reason && <p className="muted">{block.reason}</p>}</div>
          <AdminForm action={removeBlock} submit="Quitar bloqueo" compact danger><input type="hidden" name="id" value={block.id} /></AdminForm>
        </div>)}
    </section>
  </div>;
}
