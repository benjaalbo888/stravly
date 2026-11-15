import Link from "next/link";
import { Header, Footer } from "@/components/brand";
import { authenticatedClient } from "@/lib/supabase/server";
import { InviteForm } from "./invite-form";

export default async function InvitePage() {
  return <><Header /><main id="contenido" className="workspace"><div className="shell"><section className="card stack max-w-lg mx-auto">
    <h1>Invitación a un negocio</h1>
    <p>Para aceptarla, usa el mismo correo al que te invitó el propietario. Si aún no tienes cuenta, créala, confirma tu correo y vuelve a abrir el enlace.</p>
    <InviteForm signedIn={!!(await authenticatedClient())} />
    <Link href="/registro">Crear una cuenta</Link>
  </section></div></main><Footer /></>;
}
