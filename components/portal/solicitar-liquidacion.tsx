"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { crearSolicitudLiquidacion, type EstadoSolicitud } from "@/actions/portal";

const inicial: EstadoSolicitud = { error: null };
const inputCls =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15";

export default function SolicitarLiquidacion({
  token,
  disponible,
}: {
  token: string;
  disponible: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState(crearSolicitudLiquidacion, inicial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) {
      formRef.current?.reset();
      setAbierto(false);
    }
  }, [estado]);

  const horaART = Number(
    new Intl.DateTimeFormat("es-AR", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Argentina/Buenos_Aires",
    }).format(new Date())
  );
  const fueraDeHorario = horaART >= 15;

  if (disponible <= 0 && !abierto) return null;

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-emerald-950/50 transition hover:bg-emerald-500"
      >
        + Solicitar transferencia
      </button>
    );
  }

  return (
    <form ref={formRef} action={accion} className="grid gap-2.5">
      <input type="hidden" name="token" value={token} />
      {fueraDeHorario && (
        <p className="rounded-lg border border-amber-900 bg-amber-950/60 px-3 py-2 text-xs text-amber-300">
          Son más de las 15:00 hs — las solicitudes cargadas ahora serán rechazadas. Volvé mañana y
          la procesamos a primera hora.
        </p>
      )}
      <input
        name="monto"
        type="number"
        step="0.01"
        min="500000"
        max={disponible}
        placeholder={`Monto (mín. $500.000 — hasta $${disponible.toLocaleString("es-AR")})`}
        required
        className={inputCls}
      />
      <input name="beneficiario" placeholder="Beneficiario (razón social) *" required className={inputCls} />
      <input name="cvu_cbu_destino" placeholder="CBU/CVU destino (22 dígitos)" className={inputCls} />
      <input name="alias_destino" placeholder="Alias destino" className={inputCls} />
      <input name="cuit_beneficiario" placeholder="CUIT/CUIL del beneficiario *" required className={inputCls} />
      <input name="nota" placeholder="Nota (opcional)" className={inputCls} />
      <p className="text-[10px] text-zinc-500">
        CBU/CVU o Alias: al menos uno. Mínimo $500.000 por transferencia · personas físicas hasta
        $6.000.000 por operación · solicitudes hasta las 15:00 hs (Argentina).
      </p>

      {estado.error && (
        <p className="rounded-lg border border-red-900 bg-red-950 px-3 py-2 text-xs text-red-300">
          {estado.error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pendiente}
          className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {pendiente ? "Enviando…" : "Enviar solicitud"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
