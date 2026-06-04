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
          className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
        />
      ))}
      <button
        type="submit"
        disabled={pendiente}
        className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
      >
        {pendiente ? "…" : etiqueta}
      </button>
      {estado.error && <span className="text-xs text-red-400">{estado.error}</span>}
    </form>
  );
}
