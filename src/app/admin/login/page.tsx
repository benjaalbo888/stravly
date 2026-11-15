import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Footer, Header } from "@/components/brand";
import { adminClient } from "@/lib/supabase/server";
import { publicConfig } from "@/lib/supabase/env";
import { AdminForm } from "../admin-form";
import { signIn } from "../actions";

export const metadata: Metadata = { title: "Acceso administrador", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Login() {
  if (await adminClient()) redirect("/admin");
  const ready = publicConfig();
  return <><Header /><main id="contenido" className="workspace"><div className="shell">
    <section className="card auth-card stack" aria-labelledby="acceso">
      <span className="feature-icon"><ShieldCheck aria-hidden="true" /></span>
      <div><p className="eyebrow">PANEL PRIVADO</p><h1 id="acceso" className="!text-3xl">Acceso administrador</h1></div>
      <p className="muted">Inicia sesión para gestionar la agenda de tu negocio.</p>
      {ready ? <AdminForm action={signIn} submit="Iniciar sesión">
        <label className="field">Correo electrónico<input type="email" autoComplete="username" name="email" required maxLength={160} /></label>
        <label className="field">Contraseña<input type="password" autoComplete="current-password" name="password" required maxLength={256} /></label>
      </AdminForm> : <p className="notice" role="status">El acceso no está disponible en este momento.</p>}
    </section>
  </div></main><Footer /></>;
}
