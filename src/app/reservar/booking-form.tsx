"use client";

import { useActionState, useEffect, useState } from "react";
import Image from "next/image";
import { CalendarDays, Check, Clock3, Scissors, UserRound } from "lucide-react";
import { dateLabel, money, santiagoDate, timeLabel } from "@/lib/schedule";
import type { BookingState, Catalog, Service } from "@/lib/models";
import { reserve, reserveDemo } from "./actions";

type SlotsState = { key: string; slots?: string[]; error?: string };

type BookingProps = { services: Service[]; today: string; lastDay: string; slug?: string; workers?: Catalog["workers"]; demo?: boolean };

export function BookingForm(props: BookingProps) {
  const [reset, setReset] = useState(0);
  return <Wizard key={reset} {...props} reset={() => setReset((n) => n + 1)} />;
}

function Wizard({ services, today, lastDay, reset, slug, workers, demo = false }: BookingProps & { reset: () => void }) {
  const [serviceId, setServiceId] = useState("");
  const [worker, setWorker] = useState("");
  const [date, setDate] = useState(demo ? today : "");
  const [slot, setSlot] = useState("");
  const [attempt, retry] = useState(0);
  const [response, setResponse] = useState<SlotsState>({ key: "" });
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const service = services.find((item) => item.id === serviceId);
  const chooseWorker = Boolean(slug) || demo;
  const professionals = workers?.filter((person) => person.services.includes(serviceId)) ?? [];
  const key = `${serviceId}:${worker}:${date}:${attempt}`;
  const validDate = date >= today && date <= lastDay;
  const canRequest = !!service && validDate && (!chooseWorker || (professionals.length > 0 && !!worker));
  const current = response.key === key ? response : undefined;
  const [state, action, pending] = useActionState(async (prev: BookingState, form: FormData) => {
    const next = demo ? await reserveDemo(form) : await reserve(slug ?? null, prev, form);
    if (next.retrySlots) {
      setSlot("");
      retry((n) => n + 1);
    }
    return next;
  }, {});

  useEffect(() => {
    if (!canRequest) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ servicio: serviceId, fecha: date });
    if (slug) query.set("negocio", slug);
    if (demo) query.set("demo", "1");
    if (slug || demo) query.set("profesional", worker);
    async function load() {
      try {
        const result = await fetch(`/api/horarios?${query}`, { signal: controller.signal });
        const payload = await result.json();
        if (!result.ok || !Array.isArray(payload.slots)) throw new Error("Horarios no disponibles");
        if (!controller.signal.aborted) setResponse({ key, slots: payload.slots });
      } catch {
        if (!controller.signal.aborted) setResponse({ key, error: "No pudimos cargar los horarios." });
      }
    }
    void load();
    return () => controller.abort();
  }, [canRequest, serviceId, date, demo, key, slug, worker]);

  useEffect(() => {
    if (state.confirmed) document.getElementById("confirmacion")?.focus();
  }, [state.confirmed]);

  if (state.confirmed) {
    const { code, service, startsAt, duration, price, worker: confirmedWorker } = state.confirmed;
    return <section className="card auth-card booking-success stack" aria-labelledby="confirmacion">
      <span className="feature-icon"><Check aria-hidden="true" /></span>
      <h2 id="confirmacion" tabIndex={-1}>{demo ? "¡Reserva de prueba confirmada!" : "¡Cita confirmada!"}</h2>
      <p>{demo ? "La prueba ha terminado. No se guardó una cita ni se envió un correo." : "Guarda este código para identificar tu reserva:"}</p><p><strong className="booking-code">{code}</strong></p>
      {confirmedWorker && <p>{demo ? "Profesional asignado: " : "Te atenderá "}<strong>{confirmedWorker}</strong>.</p>}
      <Recap service={service} date={santiagoDate(new Date(startsAt))} start={startsAt} duration={duration} price={price} />
      <button type="button" className="button button-quiet" onClick={reset}>{demo ? "Volver a probar" : "Hacer otra reserva"}</button>
    </section>;
  }

  return <form action={action} className="two-columns booking-flow">
    <fieldset disabled={pending} className="booking-steps stack min-w-0">
      <legend className="sr-only">Detalles de la cita</legend>
      <section className="card" aria-labelledby="servicio">
        <div className="card-title"><Scissors size={20} aria-hidden="true" /><h2 id="servicio">1. Elige un servicio</h2></div>
        <div className="choice-grid" role="radiogroup" aria-labelledby="servicio">{services.map((item) =>
          <label className="choice" key={item.id}><input type="radio" name="service" value={item.id} checked={item.id === serviceId}
            onChange={() => { setServiceId(item.id); setWorker(""); setSlot(""); }} required />
            <span><strong>{item.name}</strong><small>{item.description} · {item.duration_minutes} min</small></span>
            <span className="choice-price">{money(item.price_clp)}</span>
          </label>
        )}</div>
      </section>
      {chooseWorker && <section className="card stack" aria-labelledby="profesional">
        <div className="card-title !mb-0"><UserRound size={20} aria-hidden="true" /><h2 id="profesional">Elige un profesional</h2></div>
        {!service ? <p className="muted">Selecciona un servicio para ver quién puede atenderte.</p>
          : !professionals.length ? <p className="notice">Todavía no hay profesionales asignados a este servicio.</p>
          : <div className="choice-grid" role="radiogroup" aria-labelledby="profesional">
            {professionals.length > 1 && <label className="choice"><input type="radio" name="worker" value="any" checked={worker === "any"}
              onChange={() => { setWorker("any"); setSlot(""); }} required />Cualquier profesional disponible</label>}
            {professionals.map((person) => <label className="choice" key={person.id}>
              <input type="radio" name="worker" value={person.id} checked={worker === String(person.id)}
                onChange={() => { setWorker(String(person.id)); setSlot(""); }} required />
              {person.photo_url ? <Image src={person.photo_url} alt="" width={40} height={40} unoptimized referrerPolicy="no-referrer" className="size-10 rounded-full object-cover" />
                : <span className="person-avatar" aria-hidden="true">{person.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</span>}
              <span><strong>{person.name}</strong>{person.description && <small>{person.description}</small>}</span>
            </label>)}
          </div>}
      </section>}
      <section className="card stack" aria-labelledby="fecha-hora">
        <div className="card-title !mb-0"><CalendarDays size={20} aria-hidden="true" /><h2 id="fecha-hora">2. Elige fecha y hora</h2></div>
        <label className="field">Fecha<input type="date" name="date" min={today} max={lastDay} value={date} required
          onChange={(event) => { setDate(event.target.value); setSlot(""); }} /></label>
        <div aria-live="polite" aria-busy={canRequest && !current}>
          {!canRequest && <p className="muted">{chooseWorker ? "Selecciona un servicio, un profesional y una fecha para ver los horarios." : "Selecciona un servicio y una fecha para ver los horarios."}</p>}
          {canRequest && !current && <p className="muted">Cargando horarios…</p>}
          {current?.error && <div className="notice error">{current.error} <button className="button button-quiet button-small" type="button" onClick={() => retry((n) => n + 1)}>Reintentar</button></div>}
          {current?.slots?.length === 0 && <p className="notice">No quedan horarios para este día. Prueba con otra fecha.</p>}
          {!!current?.slots?.length && <div className="slots" role="radiogroup" aria-label="Horarios disponibles">
            {current.slots.map((time) => <label className="slot" key={time}><input required type="radio" name="start" value={time} checked={slot === time}
              onChange={() => setSlot(time)} />{timeLabel(time)}{current.slots?.filter((item) => timeLabel(item) === timeLabel(time)).length !== 1 &&
                ` (${new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", timeZoneName: "shortOffset" }).formatToParts(new Date(time)).find((part) => part.type === "timeZoneName")?.value})`}</label>)}
          </div>}
        </div>
        <p className="muted text-xs"><Clock3 className="inline" size={14} aria-hidden="true" /> Horario de Santiago de Chile.</p>
      </section>
      {!demo && <section className="card stack" aria-labelledby="tus-datos">
        <div className="card-title !mb-0"><UserRound size={20} aria-hidden="true" /><h2 id="tus-datos">3. Completa tus datos</h2></div>
        <label className="field">Nombre<input name="name" autoComplete="name" required maxLength={80} minLength={2}
          value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} /></label>
        <div className="field-pair">
          <label className="field">Correo electrónico<input name="email" type="email" autoComplete="email" required maxLength={160}
            value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} /></label>
          <label className="field">Teléfono<input name="phone" type="tel" autoComplete="tel" required maxLength={25} placeholder="+56 9 0000 0000"
            value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} /></label>
        </div>
        <div className="trap" aria-hidden="true"><label>Sitio web<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
        <p className="muted text-xs">Usamos estos datos para gestionar tu cita.{(!slug || slug === "estudio-norte") && " En la agenda de demostración, usa datos ficticios."}</p>
      </section>}
    </fieldset>
    <aside className="card stack booking-recap" aria-label="Resumen de la cita">
      <h2>Detalles de la cita</h2>
      <Recap service={service?.name} date={validDate ? date : undefined} start={slot} duration={service?.duration_minutes} price={service?.price_clp} />
      {state.error && <p className="notice error" role="alert">{state.error}</p>}
      <button className="button button-primary" disabled={pending || !slot || !current?.slots?.includes(slot)}>{pending ? "Confirmando…" : demo ? "Confirmar reserva de prueba" : "Confirmar reserva"}</button>
      {demo && <p className="muted text-xs">Los precios son ilustrativos y la cita no se guarda.</p>}
    </aside>
  </form>;
}

function Recap({ service, date, start, duration, price }: { service?: string; date?: string; start?: string; duration?: number; price?: number }) {
  return <dl className="recap">
    <div><dt>Servicio</dt><dd>{service ?? "Por seleccionar"}</dd></div>
    <div><dt>Fecha y hora</dt><dd>{date ? dateLabel(date, true) : "Por seleccionar"}{start && ` · ${timeLabel(start)}`}</dd></div>
    <div><dt>Duración</dt><dd>{duration ? `${duration} min` : "—"}</dd></div>
    <div><dt>Precio informativo</dt><dd>{price !== undefined ? money(price) : "—"}</dd></div>
  </dl>;
}
