import Link from "next/link";
import { ArrowRight, CalendarDays, Check, Clock3, Link2, UsersRound } from "lucide-react";
import { Footer, Header } from "@/components/brand";

const ownerFeatures = [
  { icon: Link2, title: "Tu enlace de reservas", text: "Comparte tu página por WhatsApp o en redes. Tus clientes eligen un servicio y reservan desde el teléfono." },
  { icon: UsersRound, title: "Una agenda por profesional", text: "Configura qué servicios realiza cada persona, sus horarios y los días que debe bloquear." },
  { icon: CalendarDays, title: "Todo el equipo en un calendario", text: "Consulta las citas por día, semana o profesional desde el panel del negocio." },
];

const clientFeatures = [
  { icon: Link2, title: "Reserva desde tu teléfono", text: "Elige el servicio que necesitas desde el enlace del negocio." },
  { icon: Clock3, title: "Consulta los horarios", text: "Ve la disponibilidad antes de confirmar tu cita." },
  { icon: CalendarDays, title: "Guarda tu confirmación", text: "Recibe un código y los detalles de tu reserva." },
];

function AgendaExample() {
  const days = ["Martes", "Miércoles", "Jueves"];
  const events = [
    { day: "Martes", time: "10:00", service: "Corte de pelo", person: "Camila", tone: "green" },
    { day: "Miércoles", time: "11:00", service: "Corte y barba", person: "Martín", tone: "blue" },
    { day: "Jueves", time: "10:00", service: "Perfilado de barba", person: "Camila", tone: "green" },
    { day: "Jueves", time: "12:00", service: "Corte de pelo", person: "Martín", tone: "blue" },
  ];

  return <figure className="hero-agenda" aria-label="Vista de ejemplo de la agenda de Barbería Demo">
    <div className="hero-agenda-bar">
      <div className="hero-agenda-business"><span className="hero-agenda-icon"><CalendarDays aria-hidden="true" size={21} /></span>
        <div><strong>Barbería Demo</strong><small>Agenda semanal</small></div></div>
      <span className="hero-agenda-caption">Vista de ejemplo</span>
    </div>
    <div className="hero-agenda-grid" aria-hidden="true">
      <span className="hero-agenda-spacer" />
      {days.map((day) => <strong className="hero-agenda-day" key={day}>{day}</strong>)}
      {["10:00", "11:00", "12:00"].map((time) => <div className="hero-agenda-row" key={time}>
        <span className="hero-agenda-time">{time}</span>
        {days.map((day) => {
          const event = events.find((item) => item.day === day && item.time === time);
          return <div className="hero-agenda-cell" key={day}>{event && <div className={`hero-agenda-event ${event.tone}`}><strong>{event.service}</strong><small>{event.person}</small></div>}</div>;
        })}
      </div>)}
    </div>
    <div className="hero-agenda-footer"><span><span className="agenda-dot" /> Camila Ríos</span><span><span className="agenda-dot blue" /> Martín Vega</span></div>
  </figure>;
}

export default function Home() {
  const multi = process.env.STRAVLY_MULTI_BUSINESS === "1";
  const features = multi ? ownerFeatures : clientFeatures;

  return <>
    <Header />
    <main id="contenido">
      <section className="hero">
        <div className="shell hero-layout">
          <div className="hero-copy">
            <p className="eyebrow">{multi ? "AGENDA ONLINE PARA NEGOCIOS" : "RESERVAS ONLINE"}</p>
            <h1>{multi ? <>Tu agenda.<br /><span>A tu ritmo.</span></> : "Tus reservas, sin complicaciones."}</h1>
            <p>{multi ? "Organiza los horarios de tu equipo y recibe reservas desde tu propio enlace." : "Elige un servicio, encuentra un horario libre y confirma tu cita en minutos."}</p>
            <div className="hero-actions">
              <Link className="button button-primary" href={multi ? "/demo" : "/reservar"}>{multi ? "Probar demo" : "Reservar una cita"} <ArrowRight size={17} aria-hidden="true" /></Link>
              <Link className="button button-quiet" href={multi ? "/registro" : "/demo"}>{multi ? "Crear mi negocio" : "Probar demo"}</Link>
            </div>
            <p className="hero-note"><Check size={15} aria-hidden="true" /> La demo no requiere registro</p>
          </div>
          <AgendaExample />
        </div>
      </section>
      <section className="section shell" id="como-funciona" aria-labelledby="ventajas">
        <div className="section-intro"><h2 id="ventajas">{multi ? "Así funciona Stravly" : "Tu próxima cita en línea"}</h2>
          <p>{multi ? "Configura tu equipo, publica el enlace y gestiona las citas desde el panel." : "Elige un servicio, encuentra un horario y guarda tu confirmación."}</p></div>
        <div className="feature-grid">
          {features.map(({ icon: Icon, title, text }) => <article className="feature-card" key={title}>
            <span className="feature-icon"><Icon size={22} aria-hidden="true" /></span><h3>{title}</h3><p>{text}</p>
          </article>)}
        </div>
        <div className="cta-banner"><div><h2>{multi ? "Abre tu agenda a nuevas reservas" : "Elige tu próximo horario"}</h2></div>
          <Link className="button button-light" href={multi ? "/registro" : "/reservar"}>{multi ? "Crear cuenta" : "Ver servicios"} <ArrowRight size={17} aria-hidden="true" /></Link>
        </div>
      </section>
    </main>
    <Footer />
  </>;
}
