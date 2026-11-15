"use server";

import { redirect } from "next/navigation";
import { sessionClient } from "@/lib/supabase/server";
import { field, isEmail } from "@/lib/validation";
import type { FormState } from "@/lib/models";

export async function accountLogin(_previous: FormState, form: FormData): Promise<FormState> {
  if (process.env.STRAVLY_MULTI_BUSINESS !== "1") return { error: "El acceso multiempresa aún no está habilitado." };
  const email = field(form, "email").toLowerCase();
  const password = form.get("password");
  if (!isEmail(email) || typeof password !== "string" || !password || password.length > 256) return { error: "Revisa el correo y la contraseña." };
  const client = await sessionClient(true);
  if (!client) return { error: "El acceso no está disponible." };
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) return { error: "No pudimos iniciar sesión. Revisa tus datos o confirma tu correo." };
  redirect(field(form, "invite") === "1" ? "/invitacion" : "/dashboard");
}

export async function accountRegister(_previous: FormState, form: FormData): Promise<FormState> {
  if (process.env.STRAVLY_MULTI_BUSINESS !== "1") return { error: "El registro aún no está habilitado." };
  const email = field(form, "email").toLowerCase();
  const password = form.get("password");
  if (field(form, "website") || !isEmail(email) || typeof password !== "string" || password.length < 10 || password.length > 72 || new TextEncoder().encode(password).length > 72) {
    return { error: "Ingresa un correo válido y una contraseña de 10 a 72 caracteres sin exceder 72 bytes." };
  }
  const client = await sessionClient(true);
  if (!client) return { error: "El registro no está disponible." };
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) return { error: error.code === "signup_disabled" ? "El registro de cuentas aún no está habilitado." : "No pudimos completar el registro. Revisa tus datos o intenta más tarde." };
  redirect(data.session ? "/dashboard" : "/confirmar");
}

export async function accountConfirm(_previous: FormState, form: FormData): Promise<FormState> {
  if (process.env.STRAVLY_MULTI_BUSINESS !== "1") return { error: "La confirmación aún no está habilitada." };
  const email = field(form, "email").toLowerCase();
  const token = field(form, "code");
  if (!isEmail(email) || !/^\d{6,10}$/.test(token)) return { error: "Ingresa tu correo y el código que recibiste." };
  const client = await sessionClient(true);
  const result = await client?.auth.verifyOtp({ email, token, type: "email" });
  if (!result || result.error) return { error: "El código es incorrecto o caducó." };
  redirect("/dashboard");
}

export async function accountLogout() {
  await (await sessionClient(true))?.auth.signOut({ scope: "local" });
  redirect("/login");
}
