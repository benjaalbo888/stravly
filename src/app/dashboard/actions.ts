"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authenticatedClient } from "@/lib/supabase/server";
import { field, integer, isClock, isDate, isEmail, isSlug, isUuid, workerId } from "@/lib/validation";
import type { FormState } from "@/lib/models";

const invalid = { error: "Revisa los campos del formulario." };
const denied = { error: "No tienes permisos para gestionar este negocio." };
const failed = { error: "No se pudo guardar. Revisa los datos o vuelve a intentarlo." };

function profile(form: FormData) {
  const values = { name: field(form,"name"), description: field(form,"description"), category: field(form,"category"),
    location: field(form,"location"), phone: field(form,"phone"), email: field(form,"email").toLowerCase() };
  if (values.name.length < 2 || values.name.length > 100 || values.description.length > 500 || values.category.length < 2
    || values.category.length > 60 || values.location.length > 160 || values.phone.length > 30
    || (values.email && !isEmail(values.email))) return null;
  return values;
}

export async function onboard(_state: FormState, form: FormData): Promise<FormState> {
  if (process.env.STRAVLY_MULTI_BUSINESS !== "1") return denied;
  const client = await authenticatedClient();
  if (!client) return { error: "Inicia sesión y confirma tu correo." };
  const values = profile(form);
  const slug = field(form,"slug");
  const name = field(form,"worker");
  const from = field(form,"from");
  const to = field(form,"to");
  const days = form.getAll("days").map(Number);
  if (!values || !values.phone || !values.email || !isSlug(slug) || slug === "estudio-norte" || name.length < 2 || name.length > 80
    || !isClock(from) || !isClock(to) || from >= to || !days.length || days.some((n) => !Number.isInteger(n) || n < 1 || n > 7)) return invalid;
  const { data, error } = await client.rpc("create_business", {
    p_name: values.name, p_description: values.description, p_category: values.category,
    p_location: values.location, p_phone: values.phone, p_email: values.email,
    p_slug: slug, p_worker: name, p_hour_from: from, p_hour_to: to, p_days: days,
  });
  if (error?.code === "23505") return { error: "Ese enlace ya está en uso. Elige otro." };
  if (error || !data) return { error: "No pudimos crear el negocio. Confirma tu correo y revisa los datos." };
  redirect(`/dashboard/${data}?tab=servicios`);
}

async function actor(business: string, owner = false) {
  if (process.env.STRAVLY_MULTI_BUSINESS !== "1" || !isUuid(business)) return null;
  const client = await authenticatedClient();
  const { data } = await client?.rpc("business_role", { p_business: business }) ?? {};
  return client && (data === "owner" || (!owner && data === "admin")) ? client : null;
}

function saved(business: string, success: string): FormState {
  revalidatePath(`/dashboard/${business}`);
  revalidatePath("/dashboard");
  return { success };
}

export async function updateProfile(business: string, _state: FormState, form: FormData): Promise<FormState> {
  const client = await actor(business, true);
  const values = profile(form);
  if (!client) return denied;
  if (!values) return invalid;
  const { error } = await client.from("businesses").update(values).eq("id",business).select("id").single();
  return error ? failed : saved(business, "Configuración guardada.");
}

export async function editService(business: string, _state: FormState, form: FormData): Promise<FormState> {
  const client = await actor(business);
  if (!client) return denied;
  const id = field(form,"id");
  const name = field(form,"name");
  const description = field(form,"description");
  const duration = integer(field(form,"duration"),15,180);
  const price = integer(field(form,"price"),0,1000000);
  if ((id && !isUuid(id)) || name.length < 2 || name.length > 80 || description.length > 240 || !duration || duration % 15 || price === undefined) return invalid;
  const values = { name, description, duration_minutes: duration, price_clp: price, active: form.has("active") };
  const query = client.from("business_services");
  const { error } = await (id ? query.update(values).eq("business_id",business).eq("id",id) : query.insert({ ...values,business_id:business })).select("id").single();
  return error ? failed : saved(business,"Servicio guardado. Revisa sus asignaciones en Trabajadores.");
}

export async function editWorker(business: string, _state: FormState, form: FormData): Promise<FormState> {
  const client = await actor(business);
  if (!client) return denied;
  const id = field(form,"id");
  const name = field(form,"name");
  const description = field(form,"description");
  const photo = field(form,"photo");
  if ((id && !workerId(id)) || name.length < 2 || name.length > 80 || description.length > 300 || photo.length > 500) return invalid;
  if (photo) {
    try { const url = new URL(photo); if (url.protocol !== "https:" || url.username || url.password) return invalid; }
    catch { return invalid; }
  }
  const values = { name, description, photo_url: photo, active: form.has("active") };
  const query = client.from("workers");
  const { error } = await (id ? query.update(values).eq("business_id",business).eq("id",workerId(id)!) : query.insert({ ...values,business_id:business })).select("id").single();
  return error ? failed : saved(business,"Profesional guardado. Configura su horario y servicios.");
}

export async function assignServices(business: string, worker: number, _state: FormState, form: FormData): Promise<FormState> {
  const client = await actor(business);
  if (!client) return denied;
  const services = form.getAll("services").map(String);
  if (services.length > 100 || services.some((id) => !isUuid(id))) return invalid;
  const { error } = await client.rpc("assign_worker_services", { p_business: business,p_worker: worker,p_services: services });
  return error ? failed : saved(business,"Servicios asignados.");
}

export async function editHours(business: string, worker: number | null, _state: FormState, form: FormData): Promise<FormState> {
  const client = await actor(business, worker === null);
  if (!client) return denied;
  const hours = Array.from({length:7}, (_,i) => ({ weekday:i+1, opens_at:field(form,`from-${i+1}`),
    closes_at:field(form,`to-${i+1}`), active:form.has(`active-${i+1}`) }));
  if (hours.some((h) => !isClock(h.opens_at) || !isClock(h.closes_at) || h.opens_at >= h.closes_at)) return invalid;
  const { error } = await client.rpc("save_business_hours",{ p_business:business,p_worker:worker,p_hours:hours });
  return error ? failed : saved(business,"Horario guardado.");
}

export async function createBlock(business: string, _state: FormState, form: FormData): Promise<FormState> {
  const client = await actor(business);
  if (!client) return denied;
  const date = field(form,"date");
  const worker = field(form,"worker");
  const from = field(form,"from");
  const to = field(form,"to");
  const reason = field(form,"reason");
  if (!isDate(date) || (worker && !workerId(worker)) || reason.length > 100 ||
    ((from || to) && (!isClock(from) || !isClock(to) || from >= to))) return invalid;
  const { error } = await client.rpc("add_business_block",{ p_business:business,p_worker:workerId(worker),p_date:date,p_from:from||null,p_to:to||null,p_reason:reason });
  if (error?.code === "23P01") return { error: "Hay una cita confirmada en ese horario. Cancélala primero." };
  return error ? failed : saved(business,"Bloqueo guardado.");
}

export async function deleteBlock(business: string, id: string): Promise<FormState> {
  const client = await actor(business);
  if (!client) return denied;
  const { error } = await client.from("business_blocks").delete().eq("business_id",business).eq("id",id).select("id").single();
  return error ? failed : saved(business,"Bloqueo eliminado.");
}

export async function cancelAppointment(business: string, id: string): Promise<FormState> {
  const client = await actor(business);
  if (!client) return denied;
  const { error } = await client.from("business_bookings").update({status:"cancelled"}).eq("business_id",business).eq("id",id).select("id").single();
  return error ? failed : saved(business,"Reserva cancelada.");
}

export async function createInvite(business: string, _state: FormState, form: FormData): Promise<FormState> {
  const client = await actor(business,true);
  if (!client) return denied;
  const email = field(form,"email").toLowerCase();
  if (!isEmail(email)) return invalid;
  const { data, error } = await client.rpc("invite_business_admin",{ p_business:business,p_email:email });
  return error || typeof data !== "string" ? failed : { ...saved(business,"Comparte el enlace con la persona invitada. Caduca en 48 horas."),inviteToken:data };
}

export async function revokeAccess(business: string, id: string, invite: boolean): Promise<FormState> {
  const client = await actor(business,true);
  if (!client) return denied;
  const { error } = await client.rpc("remove_business_access",{ p_business:business,p_target:id,p_invite:invite });
  return error ? failed : saved(business,"Acceso retirado.");
}

export async function joinBusiness(_state: FormState, form: FormData): Promise<FormState> {
  if (process.env.STRAVLY_MULTI_BUSINESS !== "1") return denied;
  const token = field(form,"token");
  if (!/^[a-f0-9]{64}$/.test(token)) return { error:"Abre un enlace de invitación válido." };
  const client = await authenticatedClient();
  if (!client) return { error:"Inicia sesión con el correo al que se envió la invitación." };
  const { data, error } = await client.rpc("accept_business_invite",{ p_token:token });
  if (error || !data) return { error:"La invitación caducó, ya se usó o corresponde a otro correo." };
  redirect(`/dashboard/${data}`);
}
