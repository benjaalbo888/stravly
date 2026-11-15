"use client";

import { useActionState, type ReactNode } from "react";
import type { FormState } from "@/lib/models";

export function AdminForm({ action, children, submit, compact, danger, confirm }: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  children: ReactNode; submit: string; compact?: boolean; danger?: boolean; confirm?: string;
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
  </form>;
}
