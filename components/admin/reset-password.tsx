"use client";

import { useState, useTransition } from "react";
import { restablecerPassword } from "@/actions/reset-password";
import { KeyRound, Copy } from "lucide-react";

export default function ResetPassword({ userId }: { userId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [nueva, setNueva] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  if (nueva) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded border border-emerald-900 bg-success-muted px-2 py-1 font-mono text-xs text-primary">{nueva}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(nueva); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }}
          className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs text-foreground hover:bg-muted"
        >
          <Copy size={11} /> {copiado ? "¡Copiada!" : "Copiar"}
        </button>
        <span className="text-[10px] text-muted-foreground">Pasásela al usuario por un canal seguro. No se vuelve a mostrar.</span>
      </div>
    );
  }

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1 text-xs text-foreground/90 transition hover:bg-muted">
        <KeyRound size={12} /> Restablecer clave
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-warning">¿Generar una clave temporal nueva?</span>
      <button
        disabled={pendiente}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const r = await restablecerPassword({ userId });
            if (r.error) setError(r.error);
            else setNueva(r.password ?? null);
          });
        }}
        className="rounded bg-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-primary disabled:opacity-50"
      >
        {pendiente ? "Generando…" : "Sí, restablecer"}
      </button>
      <button onClick={() => setAbierto(false)} className="rounded border border-border px-2 py-1 text-xs text-foreground/90">×</button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
