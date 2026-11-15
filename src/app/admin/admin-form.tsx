"use client";

import { useActionState, type ReactNode } from "react";
import type { FormState } from "@/lib/models";

export function AdminForm({ action, children, submit, compact, danger, confirm }: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  children?: ReactNode; submit: string; compact?: boolean; danger?: boolean; confirm?: string;
}) {
  const [state, run, pending] = useActionState(action, {});
  return <form action={run} className="stack" onSubmit={confirm ? (event) => {
    if (!window.confirm(confirm)) event.preventDefault();
  } : undefined}>
    <fieldset disabled={pending} className="stack min-w-0">
      {children}
      <button className={`button ${danger ? "button-danger" : "button-primary"} ${compact ? "button-small" : "w-fit"}`} disabled={pending}>{pending ? "Guardando…" : submit}</button>
    </fieldset>
    {state.error && <p className="notice error" role="alert">{state.error}</p>}
    {state.success && <p className="notice success" role="status">{state.success}</p>}
    {state.inviteToken && <button type="button" className="button button-quiet w-fit" onClick={async (event) => {
      const button = event.currentTarget;
      const url = `${window.location.origin}/invitacion#${state.inviteToken}`;
      try { await navigator.clipboard.writeText(url); button.textContent = "Enlace copiado"; }
      catch { window.prompt("Copia el enlace de invitación", url); }
    }}>Copiar enlace de invitación</button>}
  </form>;
}
