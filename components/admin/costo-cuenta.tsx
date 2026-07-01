"use client";
import { useState, useTransition } from "react";
import { actualizarCostoCuenta } from "@/actions/configuracion";

export default function CostoCuenta({ id, costo }: { id: string; costo: number }) {
  const [valor, setValor] = useState(String(costo));
  const [pendiente, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-1" title="Costo % que este banco nos cobra por procesar cada cheque (se descuenta de nuestra ganancia)">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Costo proc. %</span>
      <input
        type="number"
        step="0.001"
        min="0"
        max="100"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        className="w-24 rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
      />
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
      {msg && <span className={`text-xs ${msg === "✓" ? "text-primary" : "text-danger"}`}>{msg}</span>}
    </span>
  );
}
