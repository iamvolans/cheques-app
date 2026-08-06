"use client";

import { useState, useTransition } from "react";
import { actualizarMultaCuenta } from "@/actions/configuracion";

const fmtARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

export default function MultaCuenta({ id, multa }: { id: string; multa: number }) {
  const [valor, setValor] = useState(String(multa));
  const [pendiente, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const bruto = (Number(valor) || 0) * 1.21;

  return (
    <span
      className="inline-flex items-center gap-1"
      title="Costo NETO que el banco nos cobra por cada cheque rechazado. Cargalo sin IVA: el sistema muestra el bruto y en la facturación descuenta el neto, porque el IVA es crédito fiscal."
    >
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Multa rech. neto</span>
      <input
        type="number"
        step="0.01"
        min="0"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        className="w-24 rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
      />
      <span className="text-[10px] text-muted-foreground/80">= {fmtARS.format(bruto)} c/IVA</span>
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
        className="rounded bg-muted px-2 py-1 text-xs text-foreground transition hover:bg-muted disabled:opacity-50"
      >
        Guardar
      </button>
      {msg && <span className={"text-xs " + (msg === "✓" ? "text-primary" : "text-danger")}>{msg}</span>}
    </span>
  );
}
