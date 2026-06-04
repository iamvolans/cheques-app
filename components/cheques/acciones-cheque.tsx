"use client";

import { useState, useTransition } from "react";
import { cambiarEstado } from "@/actions/cheques";

export default function AccionesCheque({
  id,
  estado,
  esAdmin,
  disponible = true,
  multaBanco = 0,
}: {
  id: string;
  estado: string;
  esAdmin: boolean;
  disponible?: boolean;
  multaBanco?: number;
}) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rechazando, setRechazando] = useState(false);
  const [multa, setMulta] = useState("");
  const [motivo, setMotivo] = useState("");
  const [gasto, setGasto] = useState(String(multaBanco || ""));

  function ejecutar(nuevoEstado: string, extras?: { multa?: number; motivo?: string; gasto?: number }) {
    setError(null);
    startTransition(async () => {
      const r = await cambiarEstado({
        chequeId: id,
        estadoActual: estado,
        nuevoEstado,
        ...extras,
      });
      if (r.error) setError(r.error);
      else setRechazando(false);
    });
  }

  const btn =
    "rounded px-2 py-1 text-xs font-medium transition disabled:opacity-50";
  const inp =
    "w-32 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100";

  if (rechazando) {
    return (
      <div className="flex flex-col gap-1">
        <input
          type="number"
          step="0.01"
          min="0"
          placeholder="Multa al cliente ARS"
          title="Multa que se le traslada al cliente"
          value={multa}
          onChange={(e) => setMulta(e.target.value)}
          className={inp}
        />
        <input
          type="number"
          step="0.01"
          min="0"
          placeholder="Gasto banco ARS"
          title="Lo que el banco nos cobra a nosotros (gasto interno)"
          value={gasto}
          onChange={(e) => setGasto(e.target.value)}
          className={inp}
        />
        <input
          placeholder="Motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className={inp}
        />
        <div className="flex gap-1">
          <button
            disabled={pendiente}
            onClick={() =>
              ejecutar("rechazado", {
                multa: Number(multa) || 0,
                motivo,
                gasto: Number(gasto) || 0,
              })
            }
            className={`${btn} bg-red-700 text-white hover:bg-red-600`}
          >
            Confirmar
          </button>
          <button
            onClick={() => setRechazando(false)}
            className={`${btn} border border-zinc-700 text-zinc-300`}
          >
            ×
          </button>
        </div>
        {error && <p className="max-w-40 text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {estado === "en_custodia" && !disponible && (
        <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-400/90" title="Diferido: aún no llegó su fecha de cobro">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
          custodia
        </span>
      )}
      {(estado === "aceptado" || (estado === "en_custodia" && disponible)) && (
        <button
          disabled={pendiente}
          onClick={() => ejecutar("depositado")}
          className={`${btn} bg-blue-800 text-blue-100 hover:bg-blue-700`}
        >
          Depositar
        </button>
      )}
      {estado === "depositado" && (
        <button
          disabled={pendiente}
          onClick={() => ejecutar("procesado")}
          className={`${btn} bg-emerald-700 text-white hover:bg-emerald-600`}
        >
          Procesar
        </button>
      )}
      {esAdmin && (estado === "depositado" || estado === "procesado") && (
        <button
          disabled={pendiente}
          onClick={() => setRechazando(true)}
          className={`${btn} bg-red-900 text-red-200 hover:bg-red-800`}
        >
          Rechazar
        </button>
      )}
      {error && <p className="max-w-40 text-xs text-red-400">{error}</p>}
    </div>
  );
}
