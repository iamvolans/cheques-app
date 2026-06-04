"use client";

import { useActionState, useEffect, useState } from "react";
import { editarCliente, type EstadoCliente } from "@/actions/clientes";

const inicial: EstadoCliente = { error: null };

export default function EditarCliente({
  clienteId,
  email,
  fee,
  feeInterior,
}: {
  clienteId: string;
  email: string;
  fee: number;
  feeInterior: number | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState(editarCliente, inicial);

  useEffect(() => {
    if (estado.ok) setAbierto(false);
  }, [estado]);

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800"
      >
        Editar email / fees
      </button>
    );
  }

  const inputCls =
    "w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15";

  return (
    <form action={accion} className="grid w-80 gap-2 rounded-lg border border-zinc-700 bg-zinc-900 p-3">
      <input type="hidden" name="cliente_id" value={clienteId} />
      <label className="text-xs text-zinc-400">
        Email de notificaciones
        <input name="email" type="email" defaultValue={email} required className={`mt-1 ${inputCls}`} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-zinc-400">
          Fee Cámara % (CP ≤ 2000)
          <input name="fee_porcentaje" type="number" step="0.01" min="0" max="100" defaultValue={fee} required className={`mt-1 ${inputCls}`} />
        </label>
        <label className="text-xs text-zinc-400">
          Fee Interior % (CP 2001+)
          <input name="fee_interior_porcentaje" type="number" step="0.01" min="0" max="100" defaultValue={feeInterior ?? ""} placeholder="= Cámara" className={`mt-1 ${inputCls}`} />
        </label>
      </div>
      <p className="text-[10px] text-zinc-500">Solo administradores. Fee Interior vacío = se usa el de Cámara.</p>

      {estado.error && (
        <p className="rounded border border-red-900 bg-red-950 px-2 py-1 text-xs text-red-300">
          {estado.error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
