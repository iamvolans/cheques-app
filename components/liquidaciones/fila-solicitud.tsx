"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { procesarSolicitud, rechazarSolicitud, type EstadoProc } from "@/actions/liquidaciones";

const inp = "rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-emerald-500";
const inicial: EstadoProc = { error: null };

export default function FilaSolicitud({ id }: { id: string }) {
  const [modo, setModo] = useState<"" | "liquidar" | "rechazar">("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const [estado, accion, enviando] = useActionState(procesarSolicitud, inicial);

  useEffect(() => {
    if (estado.ok) setModo("");
  }, [estado]);

  if (modo === "liquidar") {
    return (
      <form action={accion} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="solicitud_id" value={id} />
        <input name="coelsa_id" placeholder="Coelsa ID *" required className={`${inp} w-36`} />
        <input name="fecha" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required className={inp} />
        <label className="text-[10px] uppercase tracking-wide text-zinc-500">
          Comprobante
          <input
            name="comprobante"
            type="file"
            accept="application/pdf,image/*"
            className="ml-1 inline-block w-44 text-xs text-zinc-400 file:mr-1 file:rounded file:border-0 file:bg-zinc-700 file:px-2 file:py-1 file:text-xs file:text-zinc-100"
          />
        </label>
        <button
          disabled={enviando}
          className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {enviando ? "Procesando…" : "Confirmar"}
        </button>
        <button type="button" onClick={() => setModo("")} className="rounded border border-zinc-700 px-2 py-1.5 text-xs text-zinc-300">×</button>
        {estado.error && <span className="text-xs text-red-400">{estado.error}</span>}
      </form>
    );
  }

  if (modo === "rechazar") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <input placeholder="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} className={`${inp} w-48`} />
        <button
          disabled={pendiente}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const r = await rechazarSolicitud({ solicitudId: id, motivo });
              if (r.error) setError(r.error);
            });
          }}
          className="rounded bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
        >
          Rechazar
        </button>
        <button onClick={() => setModo("")} className="rounded border border-zinc-700 px-2 py-1.5 text-xs text-zinc-300">×</button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button onClick={() => setModo("liquidar")} className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600">
        Liquidar
      </button>
      <button onClick={() => setModo("rechazar")} className="rounded border border-red-900 px-3 py-1.5 text-xs text-red-300 hover:bg-red-950">
        Rechazar
      </button>
    </div>
  );
}
