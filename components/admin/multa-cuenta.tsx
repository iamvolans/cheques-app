"use client";

import { useState, useTransition } from "react";
import { actualizarMultaCuenta } from "@/actions/configuracion";

export default function MultaCuenta({ id, multa }: { id: string; multa: number }) {
  const [valor, setValor] = useState(String(multa));
  const [pendiente, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-1" title="Multa que este banco nos cobra por cada cheque rechazado (gasto interno)">
      <span className="text-[10px] uppercase tracking-wide text-zinc-500">Multa rech.</span>
      <input
        type="number"
        step="0.01"
        min="0"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        className="w-24 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100"
      />
      <button
        disabled={pendiente}
        onClick={() => {
          setMsg(null);
          startTransition(async () => {
            const r = await actualizarMultaCuenta({ id, multa: Number(valor) || 0 });
            setMsg(r.error ?? "✓");
            if (!r.error) setTimeout(() => setMsg(null), 2000);
          });
        }}
        className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-50"
      >
        Guardar
      </button>
      {msg && <span className={`text-xs ${msg === "✓" ? "text-emerald-400" : "text-red-400"}`}>{msg}</span>}
    </span>
  );
}
