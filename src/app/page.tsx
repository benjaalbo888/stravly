import Link from "next/link";
import { ArrowRight, CalendarCheck2, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, MousePointer2 } from "lucide-react";
import { Footer, Header } from "@/components/brand";

const benefits = [
  { icon: MousePointer2, title: "Reserva en pocos pasos", text: "Elige el servicio que necesitas y confirma tu cita desde cualquier dispositivo." },
  { icon: Clock3, title: "Horarios en tiempo real", text: "Consulta qué horas están libres antes de confirmar tu reserva." },
  { icon: CalendarCheck2, title: "Tu cita, organizada", text: "Recibe un código de confirmación y guarda los detalles en un solo lugar." },
];
const steps = [
  { title: "Selecciona un servicio", text: "Compara las opciones, su duración y su precio." },
  { title: "Elige fecha y hora", text: "Encuentra un espacio que encaje en tu agenda." },
  { title: "Confirma tu reserva", text: "Deja tus datos y obtén tu código de reserva." },
];

function CalendarPreview() {
  return <figure className="calendar-visual" aria-label="Ilustración del calendario y los horarios de reserva">
    <div className="preview-details" aria-hidden="true">
      <div className="preview-line"><span><CalendarDays size={15} /> Disponibilidad</span><span className="preview-tag"><i /> Agenda online</span></div>
      <div className="preview-calendar">
        <div className="preview-month"><strong>Junio 2026</strong><span><ChevronLeft size={14}/><ChevronRight size={14}/></span></div>
        <div className="preview-grid">
          {["L", "M", "M", "J", "V", "S", "D"].map((day, i) => <span className="preview-weekday" key={i}>{day}</span>)}
          {Array.from({ length: 21 }, (_, i) => i + 1).map((day) => <span className={day === 12 ? "preview-selected" : day > 15 ? "preview-muted" : ""} key={day}>{day}</span>)}
        </div>
      </div>
      <div className="preview-times"><span><Clock3 size={14}/> Horarios</span><div><i>10:00</i><i>11:30</i><i>15:00</i></div></div>
    </div>
    <div className="preview-confirmed" aria-hidden="true"><span className="preview-check"><Check size={19}/></span><div><strong>¡Cita confirmada!</strong><small>Viernes, 12 de junio · 11:30</small></div></div>
    <figcaption>Vista de ejemplo</figcaption>
  </figure>;
}

export default function Home() {
  return <>
    <Header />
    <main id="contenido">
      <section className="hero">
        <div className="shell hero-layout">
          <div className="hero-copy">
            <span className="eyebrow hero-pill"><i /> RESERVAS ONLINE</span>
            <h1>Tus reservas,<br className="desktop-break" /> <span>sin complicaciones.</span></h1>
            <p>Elige un servicio, encuentra el horario que más te acomode y confirma tu cita en minutos.</p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/reservar">Reservar una cita <ArrowRight size={18} /></Link>
              <Link className="button button-quiet" href="#como-funciona">Cómo funciona</Link>
            </div>
            <div className="hero-note"><Check size={15} aria-hidden="true"/> No necesitas crear una cuenta</div>
          </div>
          <CalendarPreview />
        </div>
      </section>
      <section className="section shell" aria-labelledby="beneficios">
        <div className="section-intro"><p className="eyebrow">DISEÑADO PARA TU DÍA A DÍA</p><h2 id="beneficios">Menos vueltas, más tiempo.</h2><p>Todo lo que necesitas para reservar, en un solo lugar.</p></div>
        <div className="feature-grid">
          {benefits.map(({ icon: Icon, title, text }) => <article className="feature-card" key={title}><span className="feature-icon"><Icon size={23} aria-hidden="true" /></span><h3>{title}</h3><p>{text}</p></article>)}
        </div>
      </section>
      <section className="steps-section" id="como-funciona">
        <div className="section shell">
          <div className="section-intro"><p className="eyebrow">CÓMO FUNCIONA</p><h2>Tres pasos y tu cita es tuya.</h2></div>
          <ol className="steps-grid">
            {steps.map(({ title, text }, i) => <li key={title}><span className="step-number">0{i + 1}</span><h3>{title}</h3><p>{text}</p></li>)}
          </ol>
          <div className="cta-banner"><div><p className="eyebrow">TU PRÓXIMA CITA</p><h2>Reserva cuando quieras.</h2></div><Link className="button button-light" href="/reservar">Ver servicios <ArrowRight size={18}/></Link></div>
        </div>
      </section>
    </main>
    <Footer />
  </>;
}
