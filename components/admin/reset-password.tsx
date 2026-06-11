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
        <span className="rounded border border-emerald-900 bg-emerald-950 px-2 py-1 font-mono text-xs text-emerald-300">{nueva}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(nueva); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }}
          className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700"
        >
          <Copy size={11} /> {copiado ? "¡Copiada!" : "Copiar"}
        </button>
        <span className="text-[10px] text-zinc-500">Pasásela al usuario por un canal seguro. No se vuelve a mostrar.</span>
      </div>
    );
  }

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className="inline-flex items-center gap-1 rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800">
        <KeyRound size={12} /> Restablecer clave
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-amber-400">¿Generar una clave temporal nueva?</span>
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
        className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {pendiente ? "Generando…" : "Sí, restablecer"}
      </button>
      <button onClick={() => setAbierto(false)} className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300">×</button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
