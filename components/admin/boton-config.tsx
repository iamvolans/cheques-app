"use client";

import { useState, useTransition } from "react";

export default function BotonConfig<P>({
  accion,
  payload,
  label,
  peligro = false,
}: {
  accion: (p: P) => Promise<{ error: string | null }>;
  payload: P;
  label: string;
  peligro?: boolean;
}) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-2">
      <button
        disabled={pendiente}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const r = await accion(payload);
            if (r.error) setError(r.error);
          });
        }}
        className={`rounded px-2 py-1 text-xs font-medium transition disabled:opacity-50 ${
          peligro
            ? "bg-danger/20 text-danger hover:bg-danger/30"
            : "bg-muted text-foreground hover:bg-muted"
        }`}
      >
        {label}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
