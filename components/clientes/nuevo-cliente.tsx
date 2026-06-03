"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { crearCliente, type EstadoCliente } from "@/actions/clientes";

const inicial: EstadoCliente = { error: null };

export default function NuevoCliente() {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState(crearCliente, inicial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) {
      formRef.current?.reset();
      setAbierto(false);
    }
  }, [estado]);

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
      >
        + Nuevo cliente
      </button>
    );
  }

  const inputCls =
    "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500";

  return (
    <form
      ref={formRef}
      action={accion}
      className="grid w-full gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:grid-cols-2"
    >
      <input name="razon_social" placeholder="Razón Social *" required className={inputCls} />
      <input name="cuit" placeholder="CUIT * (30-12345678-9)" required className={inputCls} />
      <input name="email" type="email" placeholder="Email de notificaciones *" required className={inputCls} />
      <input name="fee_porcentaje" type="number" step="0.01" min="0" max="100" placeholder="Fee % * (ej: 1.25)" required className={inputCls} />

      {estado.error && (
        <p className="rounded-lg border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-300 sm:col-span-2">
          {estado.error}
        </p>
      )}

      <div className="flex gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {pendiente ? "Guardando…" : "Guardar cliente"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
