import type { Business, Hours, Service, Worker } from "@/lib/models";

export const weekdays = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];

export function ProfileFields({ business }: { business?: Business }) {
  return <>
    <label className="field">Nombre comercial<input name="name" required minLength={2} maxLength={100} defaultValue={business?.name} /></label>
    <label className="field">Descripción<textarea name="description" rows={3} maxLength={500} defaultValue={business?.description} /></label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="field">Categoría<input name="category" required maxLength={60} defaultValue={business?.category ?? "Barbería"} /></label>
      <label className="field">Dirección o ubicación (opcional)<input name="location" maxLength={160} defaultValue={business?.location} /></label>
      <label className="field">Teléfono de contacto<input name="phone" type="tel" maxLength={30} required={!business} defaultValue={business?.phone} /></label>
      <label className="field">Correo de contacto<input name="email" type="email" maxLength={160} required={!business} defaultValue={business?.email} /></label>
    </div>
    <p className="muted text-sm">Los datos de contacto aparecen en la página pública del negocio.</p>
  </>;
}

export function ScheduleFields({ hours }: { hours: Hours[] }) {
  return <div className="stack">{weekdays.map((day,i) => {
    const n = i+1;
    const current = hours.find((h) => h.weekday === n);
    return <fieldset className="admin-detail" key={day}>
      <legend>{day}</legend>
      <div className="grid items-end gap-3 grid-cols-2 sm:grid-cols-3">
        <label className="field">Desde<input name={`from-${n}`} type="time" step={900} required defaultValue={current?.opens_at.slice(0,5) ?? "10:00"} /></label>
        <label className="field">Hasta<input name={`to-${n}`} type="time" step={900} required defaultValue={current?.closes_at.slice(0,5) ?? "19:00"} /></label>
        <label className="flex gap-2 items-center"><input name={`active-${n}`} type="checkbox" defaultChecked={current?.active ?? false} /> Disponible</label>
      </div>
    </fieldset>;
  })}</div>;
}

export function ServiceFields({ item }: { item?: Service }) {
  return <>
    {item && <input type="hidden" name="id" value={item.id} />}
    <label className="field">Servicio<input name="name" required minLength={2} maxLength={80} defaultValue={item?.name} /></label>
    <label className="field">Descripción<textarea name="description" rows={2} maxLength={240} defaultValue={item?.description} /></label>
    <div className="grid grid-cols-2 gap-3">
      <label className="field">Duración en minutos<input name="duration" type="number" min={15} max={180} step={15} required defaultValue={item?.duration_minutes ?? 30} /></label>
      <label className="field">Precio (CLP)<input name="price" type="number" min={0} max={1000000} required defaultValue={item?.price_clp ?? 0} /></label>
    </div>
    <label className="flex gap-2 items-center"><input name="active" type="checkbox" defaultChecked={item?.active ?? true} /> Servicio activo</label>
  </>;
}

export function WorkerFields({ item }: { item?: Worker }) {
  return <>
    {item && <input type="hidden" name="id" value={item.id} />}
    <label className="field">Nombre del profesional<input name="name" required minLength={2} maxLength={80} defaultValue={item?.name} /></label>
    <label className="field">Descripción<textarea name="description" rows={2} maxLength={300} defaultValue={item?.description} /></label>
    <label className="field">URL HTTPS de la foto (opcional)<input type="url" name="photo" maxLength={500} defaultValue={item?.photo_url} /></label>
    <label className="flex gap-2 items-center"><input name="active" type="checkbox" defaultChecked={item?.active ?? true} /> Profesional activo</label>
  </>;
}
