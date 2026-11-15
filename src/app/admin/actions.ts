"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { adminClient, sessionClient } from "@/lib/supabase/server";
import { field, integer, isClock, isDate, isEmail, isUuid } from "@/lib/validation";
import type { FormState } from "@/lib/models";

const denied = { error: "Inicia sesión con una cuenta autorizada." };
const failed = { error: "No pudimos guardar el cambio. Intenta nuevamente." };
const invalid = { error: "Revisa los campos del formulario." };

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const email = field(form, "email").toLowerCase();
  const password = form.get("password");
  if (!isEmail(email) || typeof password !== "string" || !password || password.length > 256) {
    return { error: "Ingresa tu correo y contraseña." };
  }
  const client = await sessionClient(true);
  if (!client) return { error: "El acceso no está disponible en este momento." };
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) return { error: "No pudimos iniciar sesión con esos datos." };
  const { data } = await client.rpc("is_stravly_admin");
  if (data !== true) {
    await client.auth.signOut({ scope: "local" });
    return { error: "No pudimos iniciar sesión con esos datos." };
  }
  redirect("/admin");
}

export async function signOut() {
  const client = await sessionClient(true);
  const result = await client?.auth.signOut({ scope: "local" });
  if (result?.error) redirect("/admin?sesion=error");
  redirect("/admin/login");
}

export async function saveService(_: FormState, form: FormData): Promise<FormState> {
  const client = await adminClient();
  if (!client) return denied;
  const id = field(form, "id");
  const name = field(form, "name");
  const description = field(form, "description");
  const duration = integer(field(form, "duration"), 15, 180);
  const price = integer(field(form, "price"), 0, 1000000);
  if ((id && !isUuid(id)) || name.length < 2 || name.length > 80 || description.length > 240 ||
    duration === undefined || duration % 15 || price === undefined) return invalid;
  const values = { name, description, duration_minutes: duration, price_clp: price, active: field(form, "active") === "on" };
  const { data, error } = await (id ? client.from("services").update(values).eq("id", id) : client.from("services").insert(values))
    .select("id").single();
  if (error || !data) return failed;
  revalidatePath("/admin");
  return { success: id ? "Servicio actualizado." : "Servicio creado." };
}

export async function saveHours(_: FormState, form: FormData): Promise<FormState> {
  const client = await adminClient();
  if (!client) return denied;
  const values = [];
  for (let day = 1; day <= 7; day++) {
    const from = field(form, `from-${day}`);
    const to = field(form, `to-${day}`);
    if (!isClock(from) || !isClock(to) || from >= to) return { error: "Usa intervalos de 15 minutos y una hora de cierre posterior a la apertura." };
    values.push({ weekday: day, opens_at: from, closes_at: to, active: field(form, `active-${day}`) === "on" });
  }
  const { error } = await client.from("working_hours").upsert(values, { onConflict: "weekday" });
  if (error) return failed;
  revalidatePath("/admin");
  return { success: "Horario semanal actualizado." };
}

export async function addBlock(_: FormState, form: FormData): Promise<FormState> {
  const client = await adminClient();
  if (!client) return denied;
  const date = field(form, "date");
  const from = field(form, "from");
  const to = field(form, "to");
  const reason = field(form, "reason");
  if (!isDate(date) || reason.length > 100 || ((from || to) && (!isClock(from) || !isClock(to) || from >= to))) return invalid;
  const { error } = await client.rpc("stravly_add_block", {
    p_date: date, p_from: from || null, p_to: to || null, p_reason: reason,
  });
  if (error?.code === "23P01") return { error: "Ya hay una reserva en ese intervalo. Cancélala antes de bloquear el horario." };
  if (error?.code === "22023") return { error: "El intervalo debe ser futuro y válido en Santiago de Chile." };
  if (error) return failed;
  revalidatePath("/admin");
  return { success: "Bloqueo creado." };
}

export async function removeBlock(_: FormState, form: FormData): Promise<FormState> {
  const client = await adminClient();
  if (!client) return denied;
  const id = field(form, "id");
  if (!isUuid(id)) return invalid;
  const { error } = await client.from("blocks").delete().eq("id", id).select("id").single();
  if (error) return failed;
  revalidatePath("/admin");
  return { success: "Bloqueo eliminado." };
}

export async function cancelBooking(_: FormState, form: FormData): Promise<FormState> {
  const client = await adminClient();
  if (!client) return denied;
  const id = field(form, "id");
  if (!isUuid(id)) return invalid;
  const { error } = await client.from("bookings").update({ status: "cancelled" }).eq("id", id).select("id").single();
  if (error) return { error: "La cita ya no se puede cancelar. Actualiza la agenda." };
  revalidatePath("/admin");
  return { success: "Cita cancelada." };
}
