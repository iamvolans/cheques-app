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
            ? "border border-border text-foreground/90 hover:bg-muted"
            : "border border-danger/40 text-danger hover:bg-danger-muted"
        }`}
      >
        {pendiente ? "…" : bloqueado ? "Desbloquear" : "Bloquear destino"}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
