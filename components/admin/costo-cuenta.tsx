"use client";

import { useState, useTransition } from "react";
import { actualizarCostoCuenta } from "@/actions/configuracion";

export default function CostoCuenta({ id, costo }: { id: string; costo: number }) {
  const [valor, setValor] = useState(String(costo));
  const [pendiente, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <span
      className="inline-flex items-center gap-1"
      title="Costo NETO en % que el banco cobra por procesar cada cheque, sin IVA. No se aplica a los E-Cheq."
    >
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Costo proc. % neto</span>
      <input
        type="number"
        step="0.001"
        min="0"
        max="100"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        className="w-24 rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
      />
      <span className="text-[10px] text-muted-foreground/80">no aplica a e-cheq</span>
      <button
        disabled={pendiente}
        onClick={() => {
          setMsg(null);
          startTransition(async () => {
            const r = await actualizarCostoCuenta({ id, costo: Number(valor) || 0 });
            setMsg(r.error ?? "✓");
            if (!r.error) setTimeout(() => setMsg(null), 2000);
          });
        }}
        className="rounded bg-muted px-2 py-1 text-xs text-foreground transition hover:bg-muted disabled:opacity-50"
      >
        Guardar
      </button>
      {msg && <span className={"text-xs " + (msg === "✓" ? "text-primary" : "text-danger")}>{msg}</span>}
    </span>
  );
}
