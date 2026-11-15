import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Footer, Header } from "@/components/brand";
import { authenticatedClient } from "@/lib/supabase/server";
import type { Block, Booking, Business, Hours, Service, Worker } from "@/lib/models";
import { addDays, dateLabel, money, santiagoDate, timeLabel } from "@/lib/schedule";
import { isDate, isUuid, workerId } from "@/lib/validation";
import { AdminForm } from "@/app/admin/admin-form";
import { assignServices, cancelAppointment, createBlock, createInvite, deleteBlock, editHours, editService, editWorker, revokeAccess, updateProfile } from "../actions";
import { ProfileFields, ScheduleFields, ServiceFields, WorkerFields } from "../fields";

type Client = NonNullable<Awaited<ReturnType<typeof authenticatedClient>>>;
type Query = Record<string, string | undefined>;
type WorkerHours = Hours & { worker_id: number };
type WorkerLink = { worker_id: number; service_id: string };
type Appointment = Booking & { worker_id: number };
type AgendaBlock = Block & { worker_id: number | null };
type Summary = { today: number; upcoming: number; total: number; workers: { worker_id: number; count: number }[]; services: { service_name: string; count: number }[] };
type Access = { members: { id: string; email: string; role: string }[]; invites: { id: string; email: string; expires_at: string }[] };

export default async function BusinessDashboard({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<Query> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const client = await authenticatedClient();
  if (!client) redirect("/login");
  const [profile, rights] = await Promise.all([
    client.from("businesses").select("*").eq("id",businessId).maybeSingle(),
    client.rpc("business_role",{p_business:businessId}),
  ]);
  if (!profile.data || !rights.data) notFound();
  const business = profile.data as Business;
  const owner = rights.data === "owner";
  const query = await searchParams;
  const tabs = [
    ["agenda","Agenda"], ["trabajadores","Trabajadores"], ["servicios","Servicios"], ["horarios","Horarios y bloqueos"],
    ...(owner ? [["configuracion","Configuración"],["administradores","Administradores"]] : []),
  ];
  const tab = tabs.some(([key]) => key === query.tab) ? query.tab : "agenda";
  const path = `/dashboard/${business.id}`;
  const { data: workerData, error: workerError } = await client.from("workers").select("id,name,description,photo_url,active").eq("business_id",business.id).order("name");
  const workers = (workerData ?? []) as Worker[];
  const workerName = (id: number | null) => id === null ? "Todo el negocio" : workers.find((worker) => worker.id === id)?.name ?? "Profesional";
  return <><Header /><main id="contenido" className="workspace"><div className="shell stack">
    <div className="admin-top">
      <div className="page-intro"><p className="eyebrow">{owner ? "PROPIETARIO" : "ADMINISTRACIÓN"}</p><h1>{business.name}</h1>
        <p>Gestiona el equipo y las reservas de este negocio.</p></div>
      <div className="flex flex-wrap gap-2"><Link className="button button-quiet" href="/dashboard">Mis negocios</Link>
        <Link className="button button-primary" href={`/b/${business.slug}`}>Enlace público</Link></div>
    </div>
    <nav className="admin-tabs flex flex-wrap" aria-label="Panel del negocio">{tabs.map(([key,label]) =>
      <Link key={key} className="button button-quiet" href={`${path}?tab=${key}`} aria-current={key===tab?"page":undefined}>{label}</Link>
    )}</nav>
    {workerError && <p className="notice error" role="alert">No se pudo cargar el equipo.</p>}
    {tab === "agenda" && <Agenda client={client} id={business.id} query={query} workers={workers} workerName={workerName} />}
    {tab === "trabajadores" && !workerError && <WorkersPanel client={client} id={business.id} workers={workers} />}
    {tab === "servicios" && <ServicesPanel client={client} id={business.id} />}
    {tab === "horarios" && !workerError && <HoursPanel client={client} id={business.id} workers={workers} workerName={workerName} owner={owner} />}
    {tab === "configuracion" && owner && <section className="card stack"><h2>Configuración</h2>
      <p>Enlace de reservas: <Link className="underline" href={`/b/${business.slug}`}>/b/{business.slug}</Link></p>
      <AdminForm action={updateProfile.bind(null,business.id)} submit="Guardar configuración"><ProfileFields business={business} /></AdminForm>
    </section>}
    {tab === "administradores" && owner && <AccessPanel client={client} id={business.id} />}
  </div></main><Footer /></>;
}

async function Agenda({ client,id,query,workers,workerName }: { client: Client; id: string; query: Query; workers: Worker[]; workerName: (id: number|null) => string }) {
  const now = new Date();
  const today = santiagoDate(now);
  const date = query.fecha && isDate(query.fecha) && query.fecha >= "2000-01-01" && query.fecha <= "2099-12-31" ? query.fecha : today;
  const view = query.vista === "semana" || query.vista === "proximas" ? query.vista : "dia";
  const length = view === "semana" ? 7 : 1;
  const selected = workerId(query.profesional ?? "");
  const page = /^[1-9]\d{0,3}$/.test(query.pagina ?? "") ? Number(query.pagina) : 1;
  const [start, finish, totals] = await Promise.all([
    client.rpc("business_day_bounds",{p_date:date}).single<{day_start:string;day_end:string}>(),
    client.rpc("business_day_bounds",{p_date:addDays(date,length-1)}).single<{day_start:string;day_end:string}>(),
    client.rpc("business_agenda_summary",{p_business:id}),
  ]);
  if (!start.data || !finish.data || totals.error) return <p className="notice error" role="alert">No pudimos cargar la agenda.</p>;
  const from = view === "proximas" ? now.toISOString() : start.data.day_start;
  const end = finish.data.day_end;
  let appointments = client.from("business_bookings").select("id,code,service_name,price_clp,starts_at,ends_at,customer_name,customer_email,customer_phone,status,worker_id", {count:"exact"})
    .eq("business_id",id).gte("starts_at",from);
  let blocked = client.from("business_blocks").select("id,worker_id,starts_at,ends_at,reason").eq("business_id",id).gt("ends_at",from);
  if (view === "proximas") appointments = appointments.eq("status","confirmed");
  else { appointments = appointments.lt("starts_at",end); blocked = blocked.lt("starts_at",end); }
  if (selected) { appointments = appointments.eq("worker_id",selected); blocked = blocked.or(`worker_id.is.null,worker_id.eq.${selected}`); }
  const [appointmentResult, blockResult] = await Promise.all([
    appointments.order("starts_at").order("id").range((page-1)*50,page*50-1),
    blocked.order("starts_at").limit(100),
  ]);
  const rows = (appointmentResult.data ?? []) as Appointment[];
  const blocks = (blockResult.data ?? []) as AgendaBlock[];
  const stats = totals.data as Summary;
  const agendaPath = `/dashboard/${id}`;
  const pathFor = (d: string, n = 1) => `${agendaPath}?fecha=${d}&vista=${view}&profesional=${selected ?? ""}&pagina=${n}`;
  return <>
    <dl className="stat-grid">{[["Reservas de hoy",stats.today],["Reservas próximas",stats.upcoming],["Total histórico",stats.total]].map(([label,value]) =>
      <div className="card" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <section className="card stack"><h2>Calendario</h2>
      <form action={agendaPath} className="flex flex-wrap gap-3 items-end">
        <label className="field">Filtrar por fecha<input name="fecha" type="date" defaultValue={date} min="2000-01-01" max="2099-12-31" /></label>
        <label className="field">Vista<select name="vista" defaultValue={view}><option value="dia">Diaria</option><option value="semana">Semanal</option><option value="proximas">Próximas</option></select></label>
        <label className="field">Profesional<select name="profesional" defaultValue={selected ?? ""}><option value="">Todos</option>
          {workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name}</option>)}</select></label>
        <button className="button button-primary">Ver agenda</button>
      </form>
      {view !== "proximas" && <div className="flex flex-wrap gap-2" aria-label="Navegación de fechas">
        <Link className="button button-quiet button-small" href={pathFor(addDays(date,-length))}>Anterior</Link>
        <Link className="button button-quiet button-small" href={pathFor(today)}>Hoy</Link>
        <Link className="button button-quiet button-small" href={pathFor(addDays(date,length))}>Siguiente</Link>
      </div>}
      <h3>{view === "proximas" ? "Próximas reservas" : view === "semana" ? `${dateLabel(date)} a ${dateLabel(addDays(date,6))}` : dateLabel(date,true)}</h3>
      {appointmentResult.error && appointmentResult.error.code !== "PGRST103" ? <p className="notice error">No pudimos cargar las reservas.</p>
        : !rows.length ? <p className="muted">No hay citas en esta vista.</p>
        : <div className="overflow-x-auto" tabIndex={0} aria-label="Detalle de las reservas">
          <table><thead><tr><th scope="col">Fecha y hora</th><th scope="col">Servicio y profesional</th><th scope="col">Cliente</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.id}>
              <td>{dateLabel(santiagoDate(new Date(row.starts_at)))}<br />{timeLabel(row.starts_at)}–{timeLabel(row.ends_at)}</td>
              <td>{row.service_name}<br />{workerName(row.worker_id)}<br /><span className="muted">{row.code}</span></td>
              <td>{row.customer_name}<br />{row.customer_email}<br />{row.customer_phone}</td>
              <td><span className={`badge ${row.status === "cancelled" ? "inactive" : ""}`}>{row.status === "confirmed" ? "Confirmada" : "Cancelada"}</span></td>
              <td>{row.status === "confirmed" && Date.parse(row.starts_at) > now.valueOf() && <AdminForm compact danger action={cancelAppointment.bind(null,id,row.id)} submit="Cancelar cita" confirm="¿Confirmas la cancelación de esta cita?" />}</td>
            </tr>)}</tbody>
          </table>
        </div>}
      {((appointmentResult.count ?? 0) > page*50 || page > 1) && <div className="flex gap-2">
        {page > 1 && <Link className="button button-quiet button-small" href={pathFor(date,page-1)}>Página anterior</Link>}
        {(appointmentResult.count ?? 0) > page*50 && <Link className="button button-quiet button-small" href={pathFor(date,page+1)}>Página siguiente</Link>}
      </div>}
      <h3>Bloqueos en esta vista</h3>
      {blockResult.error ? <p className="notice error">No pudimos cargar los bloqueos.</p> : blocks.length ? <ul className="stack">{blocks.map((item) =>
        <li key={item.id}>{workerName(item.worker_id)} · {dateLabel(santiagoDate(new Date(item.starts_at)))} · {timeLabel(item.starts_at)} a {dateLabel(santiagoDate(new Date(item.ends_at)))} · {timeLabel(item.ends_at)} {item.reason && `· ${item.reason}`}</li>
      )}</ul> : <p className="muted">No hay bloqueos en esta vista.</p>}
    </section>
    <div className="two-columns">
      <section className="card stack"><h2>Próximas citas por profesional</h2>{stats.workers.length ? <ul className="stack">{stats.workers.map((item) => <li key={item.worker_id}>{workerName(item.worker_id)} · {item.count}</li>)}</ul> : <p className="muted">No hay próximas citas.</p>}</section>
      <section className="card stack"><h2>Servicios solicitados</h2>{stats.services.length ? <ul className="stack">{stats.services.map((item) => <li key={item.service_name}>{item.service_name} · {item.count}</li>)}</ul> : <p className="muted">Todavía no hay reservas confirmadas.</p>}</section>
    </div>
  </>;
}

async function WorkersPanel({ client,id,workers }: { client: Client; id: string; workers: Worker[] }) {
  const [s,a,h] = await Promise.all([
    client.from("business_services").select("id,name,active").eq("business_id",id).order("name"),
    client.from("worker_services").select("worker_id,service_id").eq("business_id",id),
    client.from("worker_hours").select("worker_id,weekday,opens_at,closes_at,active").eq("business_id",id),
  ]);
  if (s.error || a.error || h.error) return <p className="notice error">No se pudieron cargar los horarios o servicios del equipo.</p>;
  const services = s.data ?? [];
  const assigned = (a.data ?? []) as WorkerLink[];
  const hours = (h.data ?? []) as WorkerHours[];
  return <>
    <section className="card stack"><h2>Añadir profesional</h2>
      <AdminForm action={editWorker.bind(null,id)} submit="Añadir profesional"><WorkerFields /></AdminForm></section>
    <section className="card stack"><h2>Equipo</h2>
      {workers.map((worker) => <details key={worker.id} className="admin-detail" data-testid="worker-card">
        <summary>{worker.name} {worker.active ? "" : "(inactivo)"}</summary>
        <div className="stack mt-4">
          <AdminForm action={editWorker.bind(null,id)} submit="Guardar profesional"><WorkerFields item={worker} /></AdminForm>
          <h3>Servicios que realiza</h3>
          <AdminForm action={assignServices.bind(null,id,worker.id)} submit="Guardar servicios">
            {!services.length && <p className="muted">Crea un servicio desde la pestaña Servicios para asignarlo.</p>}
            {services.map((service) => <label className="flex items-center gap-2" key={service.id}>
              <input type="checkbox" name="services" value={service.id} defaultChecked={assigned.some((link) => link.worker_id===worker.id && link.service_id===service.id)} />{service.name}{!service.active && " (inactivo)"}
            </label>)}
          </AdminForm>
          <details className="admin-detail"><summary>Horario individual</summary>
            <AdminForm action={editHours.bind(null,id,worker.id)} submit="Guardar horario">
              <ScheduleFields hours={hours.filter((row) => row.worker_id===worker.id)} />
            </AdminForm>
          </details>
        </div>
      </details>)}
    </section>
  </>;
}

async function ServicesPanel({ client,id }: { client: Client; id: string }) {
  const {data,error} = await client.from("business_services").select("*").eq("business_id",id).order("name");
  return <>
    <section className="card stack"><h2>Nuevo servicio</h2>
      <AdminForm action={editService.bind(null,id)} submit="Crear servicio"><ServiceFields /></AdminForm>
    </section>
    <section className="card stack"><h2>Servicios</h2>
      {error ? <p className="notice error">No se pudieron cargar los servicios.</p> : (data as Service[]).map((service) =>
        <details key={service.id} className="admin-detail"><summary>{service.name} · {money(service.price_clp)} {!service.active && "(inactivo)"}</summary>
          <AdminForm action={editService.bind(null,id)} submit="Guardar servicio"><ServiceFields item={service} /></AdminForm>
        </details>)}
    </section>
  </>;
}

async function HoursPanel({ client,id,workers,workerName,owner }: { client: Client; id: string; workers: Worker[]; workerName: (id:number|null)=>string; owner: boolean }) {
  const [hours,blocks] = await Promise.all([
    client.from("business_hours").select("weekday,opens_at,closes_at,active").eq("business_id",id).order("weekday"),
    client.from("business_blocks").select("id,worker_id,starts_at,ends_at,reason").eq("business_id",id).gte("ends_at",new Date().toISOString()).order("starts_at").limit(100),
  ]);
  return <div className="two-columns">
    <section className="card stack"><h2>Horario del negocio</h2><p className="muted">Las citas solo se ofrecen dentro del horario del negocio y del profesional.</p>
      {!owner ? <p className="muted">El propietario puede cambiar el horario general.</p> : hours.error ? <p className="notice error">No pudimos cargar los horarios.</p> :
        <AdminForm action={editHours.bind(null,id,null)} submit="Guardar horario"><ScheduleFields hours={hours.data as Hours[]} /></AdminForm>}
    </section>
    <section className="card stack"><h2>Bloqueos</h2>
      <AdminForm action={createBlock.bind(null,id)} submit="Crear bloqueo">
        <label className="field">Profesional<select name="worker"><option value="">Todo el negocio</option>{workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
        <label className="field">Fecha del bloqueo<input name="date" type="date" required min={santiagoDate()} max={addDays(santiagoDate(),366)} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="field">Desde<input name="from" type="time" step={900} /></label>
          <label className="field">Hasta<input name="to" type="time" step={900} /></label>
        </div>
        <p className="muted text-sm">Deja ambas horas vacías para bloquear todo el día.</p>
        <label className="field">Motivo interno<input name="reason" maxLength={100} /></label>
      </AdminForm>
      {blocks.error ? <p className="notice error">No se pudieron cargar los bloqueos.</p> : (blocks.data as AgendaBlock[]).map((item) =>
        <div key={item.id} className="admin-detail stack"><p>{workerName(item.worker_id)} · {dateLabel(santiagoDate(new Date(item.starts_at)))} · {timeLabel(item.starts_at)}–{timeLabel(item.ends_at)} {item.reason && `· ${item.reason}`}</p>
          <AdminForm action={deleteBlock.bind(null,id,item.id)} submit="Quitar bloqueo" compact /></div>)}
    </section>
  </div>;
}

async function AccessPanel({ client,id }: { client: Client; id: string }) {
  const {data,error} = await client.rpc("list_business_access",{p_business:id});
  if (error || !data) return <p className="notice error">No pudimos cargar los permisos.</p>;
  const {members,invites} = data as Access;
  return <div className="two-columns">
    <section className="card stack"><h2>Usuarios autorizados</h2>
      {members.map((member) => <div key={member.id} className="admin-detail stack"><p>{member.email} · {member.role === "owner" ? "Propietario" : "Administrador"}</p>
        {member.role === "admin" && <AdminForm action={revokeAccess.bind(null,id,member.id,false)} submit="Retirar acceso" compact danger confirm="¿Retirar el acceso de este administrador?" />}
      </div>)}
    </section>
    <section className="card stack"><h2>Invitar administrador</h2>
      <p className="muted">Genera un enlace para compartir por privado. Solo puede aceptarlo la cuenta con el correo confirmado que indiques.</p>
      <AdminForm action={createInvite.bind(null,id)} submit="Generar invitación">
        <label className="field">Correo de la persona invitada<input name="email" type="email" required maxLength={160} /></label>
      </AdminForm>
      {invites.map((invite) => <div key={invite.id} className="admin-detail stack"><p>{invite.email} · Caduca el {dateLabel(santiagoDate(new Date(invite.expires_at)))}</p>
        <AdminForm action={revokeAccess.bind(null,id,invite.id,true)} submit="Revocar invitación" compact danger /></div>)}
    </section>
  </div>;
}
