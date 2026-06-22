"use client";

import { useActionState, useEffect, useRef } from "react";
import type { EstadoConfig } from "@/actions/configuracion";

type Campo = { name: string; placeholder: string; type?: string };
const inicial: EstadoConfig = { error: null };

export default function FormConfig({
  accion,
  campos,
  etiqueta,
}: {
  accion: (prev: EstadoConfig, fd: FormData) => Promise<EstadoConfig>;
  campos: Campo[];
  etiqueta: string;
}) {
  const [estado, despachar, pendiente] = useActionState(accion, inicial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) formRef.current?.reset();
  }, [estado]);

  return (
    <form ref={formRef} action={despachar} className="flex flex-wrap items-center gap-2">
      {campos.map((c) => (
        <input
          key={c.name}
          name={c.name}
          type={c.type ?? "text"}
          placeholder={c.placeholder}
          className="rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
      ))}
      <button
        type="submit"
        disabled={pendiente}
        className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary disabled:opacity-50"
      >
        {pendiente ? "…" : etiqueta}
      </button>
      {estado.error && <span className="text-xs text-danger">{estado.error}</span>}
    </form>
  );
}
