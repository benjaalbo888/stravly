"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="workspace" id="contenido"><div className="shell"><section className="card auth-card stack">
    <h1 className="!text-3xl">No se pudo cargar la página.</h1>
    <p className="muted">Puedes intentarlo de nuevo o volver al inicio.</p>
    <button type="button" onClick={reset} className="button button-primary">Reintentar</button>
    <Link className="button button-quiet" href="/">Volver al inicio</Link>
  </section></div></main>;
}
