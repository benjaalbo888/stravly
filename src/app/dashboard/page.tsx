import Link from "next/link";
import { redirect } from "next/navigation";
import { Footer, Header } from "@/components/brand";
import { authenticatedClient } from "@/lib/supabase/server";
import { accountLogout } from "@/app/cuenta/actions";
import type { Business } from "@/lib/models";

export default async function Dashboard() {
  const client = await authenticatedClient();
  if (!client) redirect("/login");
  const { data, error } = await client.from("businesses").select("id,name,slug,category").order("name");
  const businesses = (data ?? []) as Pick<Business,"id"|"name"|"slug"|"category">[];
  return <><Header /><main className="workspace" id="contenido"><div className="shell stack">
    <div className="page-intro"><p className="eyebrow">PANEL STRAVLY</p><h1>Mis negocios</h1><p>Selecciona una agenda o crea un negocio nuevo.</p></div>
    <div className="flex flex-wrap gap-3">
      <Link className="button button-primary" href="/crear-negocio">Crear mi negocio</Link>
      <form action={accountLogout}><button className="button button-quiet">Cerrar sesión</button></form>
    </div>
    {error ? <p className="notice error" role="alert">No se pudieron cargar tus negocios.</p>
      : !businesses.length ? <p className="notice">Todavía no tienes negocios asociados a esta cuenta.</p>
      : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{businesses.map((business) => <article key={business.id} className="card stack">
        <p className="eyebrow">{business.category}</p><h2>{business.name}</h2>
        <Link className="button button-primary w-fit" href={`/dashboard/${business.id}`}>Abrir panel</Link>
        <Link href={`/b/${business.slug}`}>Ver página pública</Link>
      </article>)}</div>}
  </div></main><Footer /></>;
}
