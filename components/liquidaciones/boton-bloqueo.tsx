"use client";

import { useState, useTransition } from "react";
import { bloquearDestino, desbloquearDestino } from "@/actions/liquidaciones";

export default function BotonBloqueo({ cuit, bloqueado }: { cuit: string; bloqueado: boolean }) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-2">
      <button
        disabled={pendiente}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const r = bloqueado
              ? await desbloquearDestino({ cuit })
              : await bloquearDestino({ cuit });
            if (r.error) setError(r.error);
          });
        }}
        className={`rounded px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
          bloqueado
            ? "border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            : "border border-red-900 text-red-300 hover:bg-red-950"
        }`}
      >
        {pendiente ? "…" : bloqueado ? "Desbloquear" : "Bloquear destino"}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </span>
  );
}
