"use client";

import { useActionState, useEffect, useState } from "react";
import { liquidar, type EstadoLiq } from "@/actions/liquidaciones";

const inicial: EstadoLiq = { error: null };

export default function Liquidar({
  clienteId,
  saldo,
}: {
  clienteId: string;
  saldo: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState(liquidar, inicial);

  useEffect(() => {
    if (estado.ok) setAbierto(false);
  }, [estado]);

  if (saldo <= 0) return null;

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="rounded bg-emerald-700 px-3 py-1 text-xs font-medium text-white transition hover:bg-emerald-600"
      >
        Liquidar
      </button>
    );
  }

  const inputCls =
    "w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15";

  return (
    <form action={accion} className="grid w-80 gap-2 rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-left">
      <input type="hidden" name="cliente_id" value={clienteId} />
      <input name="coelsa_id" placeholder="Coelsa ID *" required className={inputCls} />
      <input name="fecha_transferencia" type="date" required className={inputCls} title="Fecha de transferencia" />
      <input name="cvu_cbu_destino" placeholder="CBU/CVU destino (22 dígitos)" className={inputCls} />
      <input name="alias_destino" placeholder="Alias destino" className={inputCls} />
      <p className="text-[10px] text-zinc-500">CBU/CVU o Alias: cargá al menos uno (pueden ser los dos).</p>
      <input name="beneficiario" placeholder="Razón Social / Beneficiario *" required className={inputCls} />
      <input name="cuit_beneficiario" placeholder="CUIT del beneficiario" className={inputCls} />
      <input
        name="monto_liquidado"
        type="number"
        step="0.01"
        min="0.01"
        max={saldo}
        defaultValue={saldo.toFixed(2)}
        required
        className={inputCls}
        title="Monto a liquidar"
      />

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
          {pendiente ? "Registrando…" : "Confirmar transferencia"}
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
