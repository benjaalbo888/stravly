import Link from "next/link";
import { Footer, Header } from "@/components/brand";
import { AdminForm } from "@/app/admin/admin-form";
import { accountConfirm, accountLogin, accountRegister } from "./actions";

export function AccountScreen({ mode, invite = false }: { mode: "login" | "register" | "confirm"; invite?: boolean }) {
  const confirm = mode === "confirm";
  const register = mode === "register";
  const title = confirm ? "Confirma tu correo" : register ? "Crea tu cuenta" : "Inicia sesión";
  return <><Header /><main className="workspace" id="contenido"><div className="shell"><section className="card stack max-w-lg mx-auto">
    <p className="eyebrow">TU CUENTA STRAVLY</p><h1>{title}</h1>
    <p className="muted">{confirm ? "Escribe el código de confirmación que recibiste por correo." : register ? "Podrás crear tu negocio y compartir su enlace de reservas." : "Accede a tus negocios y a sus agendas."}</p>
    <AdminForm action={confirm ? accountConfirm : register ? accountRegister : accountLogin} submit={title}>
      {invite && <input type="hidden" name="invite" value="1" />}
      <label className="field">Correo electrónico<input required name="email" type="email" autoComplete="email" maxLength={160} /></label>
      {confirm
        ? <label className="field">Código<input required name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" /></label>
        : <label className="field">Contraseña<input required name="password" type="password" autoComplete={register ? "new-password" : "current-password"} minLength={register ? 10 : 1} maxLength={register ? 72 : 256} /></label>}
      {register && <div className="trap" aria-hidden="true"><label>Sitio web<input name="website" autoComplete="off" tabIndex={-1} /></label></div>}
    </AdminForm>
    <Link className="button button-quiet" href={mode === "login" ? "/registro" : "/login"}>{mode === "login" ? "Crear una cuenta" : "Volver a iniciar sesión"}</Link>
  </section></div></main><Footer /></>;
}
