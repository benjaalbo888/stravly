"use client";

import { useState, useSyncExternalStore } from "react";
import { AdminForm } from "@/app/admin/admin-form";
import { joinBusiness } from "@/app/dashboard/actions";

function subscribe(change: () => void) {
  window.addEventListener("hashchange",change);
  return () => window.removeEventListener("hashchange",change);
}

export function InviteForm({ signedIn }: { signedIn: boolean }) {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash.slice(1), () => "");
  const [stored] = useState(() => typeof window === "undefined" ? "" : sessionStorage.getItem("stravly-invite") ?? "");
  const token = hash || stored;
  if (!/^[a-f0-9]{64}$/.test(token)) return <p className="notice">Abre el enlace que te compartió el propietario.</p>;
  if (!signedIn) return <a className="button button-primary w-fit" href="/login?invitacion=1" onClick={() => sessionStorage.setItem("stravly-invite", token)}>Iniciar sesión para aceptar</a>;
  return <AdminForm action={joinBusiness} submit="Aceptar invitación"><input type="hidden" name="token" value={token} /></AdminForm>;
}
