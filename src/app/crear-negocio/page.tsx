import Link from "next/link";
import { redirect } from "next/navigation";
import { Header, Footer } from "@/components/brand";
import { authenticatedClient } from "@/lib/supabase/server";
import { AdminForm } from "@/app/admin/admin-form";
import { onboard } from "@/app/dashboard/actions";
import { ProfileFields, weekdays } from "@/app/dashboard/fields";

export default async function CreateBusiness() {
  if (!(await authenticatedClient())) redirect("/login");
  return <><Header /><main id="contenido" className="workspace"><div className="shell stack max-w-3xl">
    <div className="page-intro"><p className="eyebrow">TU NEGOCIO</p><h1>Crea tu primera agenda</h1>
      <p>Configura el negocio y agrega al primer profesional. Luego podrás definir sus servicios y horarios.</p></div>
    <section className="card stack"><AdminForm action={onboard} submit="Crear negocio">
      <ProfileFields />
      <label className="field">Enlace público<input name="slug" required minLength={3} maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="barberia-central" /></label>
      <p className="muted text-sm">Se publicará en /b/ seguido del nombre del enlace. Usa minúsculas, números y guiones.</p>
      <label className="field">Primer profesional<input name="worker" required minLength={2} maxLength={80} /></label>
      <fieldset className="stack"><legend>Días y horario inicial</legend>
        <div className="flex flex-wrap gap-3">{weekdays.map((d,i) => <label className="flex gap-2 items-center" key={d}>
          <input name="days" type="checkbox" value={i+1} defaultChecked={i<6} />{d}
        </label>)}</div>
        <div className="grid grid-cols-2 gap-3">
          <label className="field">Abre<input name="from" type="time" step={900} defaultValue="10:00" required /></label>
          <label className="field">Cierra<input name="to" type="time" step={900} defaultValue="19:00" required /></label>
        </div>
      </fieldset>
    </AdminForm></section><Link className="button button-quiet w-fit" href="/dashboard">Volver a mis negocios</Link>
  </div></main><Footer /></>;
}
