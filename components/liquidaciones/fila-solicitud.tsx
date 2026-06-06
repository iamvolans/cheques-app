"use client";

import { useState, useTransition } from "react";
import { liquidarDesdeSolicitud, rechazarSolicitud } from "@/actions/liquidaciones";

const inp = "rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-emerald-500";

export default function FilaSolicitud({ id }: { id: string }) {
  const [modo, setModo] = useState<"" | "liquidar" | "rechazar">("");
  const [coelsa, setCoelsa] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function ejecutar(fn: () => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
    });
  }

  if (modo === "liquidar") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <input placeholder="Coelsa ID *" value={coelsa} onChange={(e) => setCoelsa(e.target.value)} className={`${inp} w-36`} />
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inp} />
        <button
          disabled={pendiente}
          onClick={() => ejecutar(() => liquidarDesdeSolicitud({ solicitudId: id, coelsaId: coelsa, fecha }))}
          className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          Confirmar
        </button>
        <button onClick={() => setModo("")} className="rounded border border-zinc-700 px-2 py-1.5 text-xs text-zinc-300">×</button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    );
  }

  if (modo === "rechazar") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <input placeholder="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} className={`${inp} w-48`} />
        <button
          disabled={pendiente}
          onClick={() => ejecutar(() => rechazarSolicitud({ solicitudId: id, motivo }))}
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
