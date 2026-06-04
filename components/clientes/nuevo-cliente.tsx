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
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-emerald-950/50 transition hover:bg-emerald-500"
      >
        + Nuevo cliente
      </button>
    );
  }

  const inputCls =
    "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15";

  return (
    <form
      ref={formRef}
      action={accion}
      className="grid w-full gap-3 rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 p-5 shadow-lg shadow-black/20 sm:grid-cols-2"
    >
      <input name="razon_social" placeholder="Razón Social *" required className={inputCls} />
      <input name="cuit" placeholder="CUIT * (30-12345678-9)" required className={inputCls} />
      <input name="email" type="email" placeholder="Email de notificaciones *" required className={`${inputCls} sm:col-span-2`} />
      <input name="fee_porcentaje" type="number" step="0.01" min="0" max="100" placeholder="Fee Cámara % * (ej: 1.25)" required className={inputCls} />
      <input name="fee_interior_porcentaje" type="number" step="0.01" min="0" max="100" placeholder="Fee Interior % (opcional)" className={inputCls} />

      <p className="text-xs text-zinc-500 sm:col-span-2">
        El fee Cámara aplica a cheques con CP ≤ 2000 (Buenos Aires). Si configurás un fee
        Interior, aplica a CP 2001+; si lo dejás vacío, se usa el fee Cámara para todo.
      </p>

      {estado.error && (
        <p className="rounded-lg border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-300 sm:col-span-2">
          {estado.error}
        </p>
      )}

      <div className="flex gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-emerald-950/50 transition hover:bg-emerald-500 disabled:opacity-50"
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
