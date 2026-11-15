import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarDays, Check, Link2, UsersRound } from "lucide-react";
import { Footer, Header } from "@/components/brand";

const days = ["Lunes", "Martes", "Miércoles", "Jueves"];
const times = ["10:00", "11:00", "12:00"];
const appointments = [
  ["Corte de pelo", "Camila", 0, 0],
  ["Corte y barba", "Martín", 2, 0],
  ["Perfilado", "Camila", 1, 1],
  ["Corte de pelo", "Martín", 3, 1],
  ["Corte de pelo", "Camila", 2, 2],
] as const;

function AgendaExample() {
  return <figure className="team-preview hero__media" data-visual aria-label="Agenda de ejemplo con las citas de dos profesionales de Barbería Demo">
    <div className="team-frame app-frame">
      <div className="team-frame-header">
        <div className="team-frame-title"><span className="team-frame-mark"><CalendarDays size={18} aria-hidden="true" /></span>
          <div><strong>Barbería Demo</strong><span>Agenda semanal</span></div></div>
        <ul className="team-legend" aria-label="Profesionales">
          <li><i />Camila</li><li><i />Martín</li>
        </ul>
      </div>
      <div className="team-calendar" aria-hidden="true">
        <span className="team-clock"><CalendarDays size={13} /></span>
        {days.map((day) => <strong key={day} className="team-day">{day}</strong>)}
        {times.map((time, row) => <div className="team-row" key={time}>
          <time>{time}</time>
          {days.map((day, column) => {
            const visit = appointments.find(([, , visitColumn, visitRow]) => visitColumn === column && visitRow === row);
            return <div className="team-cell" key={day}>{visit && <div className={`team-visit ${visit[1] === "Martín" ? "team-visit-alt" : ""}`}>
              <strong>{visit[0]}</strong><span>{visit[1]}</span>
            </div>}</div>;
          })}
        </div>)}
      </div>
    </div>
  </figure>;
}

const ownerSteps = [
  { Icon: UsersRound, title: "Configura las agendas del equipo", text: "Define qué servicios hace cada profesional, cuándo trabaja y qué días necesita bloquear." },
  { Icon: Link2, title: "Comparte el enlace de tu negocio", text: "Tus clientes eligen servicio, profesional y horario desde el teléfono." },
  { Icon: CalendarDays, title: "Consulta todas las citas juntas", text: "Abre la agenda del día o de la semana. Filtra por profesional para ver quién atiende cada cita." },
];

export default function Home() {
  const multi = process.env.STRAVLY_MULTI_BUSINESS === "1";

  return <>
    <Header />
    <main id="contenido" className="landing">
      <section className="hero" data-enter>
        <div className="shell wrap hero-layout">
          <div className="hero-copy">
            <h1>{multi ? <>Tu agenda. <em>A tu ritmo.</em></> : "Tus reservas, sin complicaciones."}</h1>
            <div className="hero-side">
              <p className="hero__lead">{multi ? "Reúne las agendas de tu equipo y recibe reservas desde un solo enlace." : "Elige un servicio, encuentra un horario libre y confirma tu cita en minutos."}</p>
              <div className="hero-actions btn-row">
                <Link className="btn button button-primary" href={multi ? "/demo" : "/reservar"}>{multi ? "Probar demo" : "Reservar una cita"} <ArrowRight size={17} aria-hidden="true" /></Link>
                <Link className="btn button button-quiet" href={multi ? "/registro" : "/demo"}>{multi ? "Crear mi negocio" : "Probar demo"}</Link>
              </div>
            </div>
          </div>
          <AgendaExample />
        </div>
      </section>
      <section className="landing-process" id="como-funciona" aria-labelledby="ventajas">
        <div className="shell wrap process-layout">
          <div><h2 id="ventajas">{multi ? "Del equipo al calendario." : "Tu próxima cita en línea."}</h2>
            <p>{multi ? "Cada profesional tiene su propio horario. Tú ves las reservas de todo el negocio." : "Elige el servicio y el horario que te acomoden."}</p></div>
          <ol className="process-steps">
            {(multi ? ownerSteps : [
              { Icon: Link2, title: "Abre el enlace del negocio", text: "Consulta su catálogo y elige el servicio que necesitas." },
              { Icon: CalendarDays, title: "Elige fecha y hora", text: "Consulta los horarios disponibles antes de enviar tus datos." },
              { Icon: Check, title: "Guarda tu código", text: "Úsalo para identificar la cita confirmada." },
            ]).map(({ Icon, title, text }) => <li key={title}>
              <Icon size={20} aria-hidden="true" /><div><h3>{title}</h3><p>{text}</p></div>
            </li>)}
          </ol>
          <div className="landing-demo demo-layout">
            <div><h3>Una cita en Barbería Demo.</h3><p>Elige entre dos profesionales y confirma una reserva de prueba sin crear una cuenta.</p></div>
            <Link className="button button-light" href="/demo">Reservar en la demo <ArrowUpRight size={17} aria-hidden="true" /></Link>
          </div>
        </div>
      </section>
    </main>
    <Footer />
  </>;
}
