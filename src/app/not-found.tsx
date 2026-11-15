import Link from "next/link";
import { Footer, Header } from "@/components/brand";

export default function NotFound() {
  return <><Header /><main className="workspace" id="contenido"><div className="shell">
    <section className="card auth-card stack"><p className="eyebrow">ERROR 404</p><h1 className="!text-3xl">No encontramos esa página.</h1>
      <Link href="/" className="button button-primary">Volver al inicio</Link></section>
  </div></main><Footer /></>;
}
