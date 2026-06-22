"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { anularMovimiento } from "@/actions/correcciones";

export default function AnularMovimiento({ movimientoId }: { movimientoId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className="rounded border border-danger/40 px-2 py-0.5 text-[10px] text-danger transition hover:bg-danger-muted">
        Anular
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input inputMode="numeric" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} placeholder="MFA" className="w-20 rounded border border-border bg-background px-2 py-0.5 text-center font-mono text-[10px] tracking-widest text-foreground outline-none focus:border-primary" />
      <button
        disabled={pendiente || codigo.length !== 6}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const r = await anularMovimiento({ movimientoId, codigo });
            if (r.error) setError(r.error);
            else { setAbierto(false); setCodigo(""); router.refresh(); }
          });
        }}
        className="rounded bg-danger px-2 py-0.5 text-[10px] font-medium text-white hover:bg-danger disabled:opacity-50"
      >
        {pendiente ? "…" : "OK"}
      </button>
      <button onClick={() => { setAbierto(false); setError(null); }} className="rounded border border-border px-1.5 py-0.5 text-[10px] text-foreground/90">×</button>
      {error && <p className="w-full text-[10px] text-danger">{error}</p>}
    </div>
  );
}
