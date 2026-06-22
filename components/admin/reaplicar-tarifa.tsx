"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reaplicarTarifaCliente } from "@/actions/correcciones";
import { RefreshCw } from "lucide-react";

export default function ReaplicarTarifa({
  clienteId,
  feeCamara,
  feeInterior,
}: {
  clienteId: string;
  feeCamara: number;
  feeInterior: number | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/90 transition hover:bg-muted">
        <RefreshCw size={13} /> Reaplicar tarifa vigente
      </button>
    );
  }

  return (
    <div className="grid w-80 gap-2 rounded-lg border border-border bg-card p-3 text-left">
      <p className="text-xs font-medium text-foreground/90">Reaplicar tarifa a todos sus cheques</p>
      <p className="text-[10px] text-muted-foreground">
        Recalcula el fee de todos los cheques de este cliente con su tarifa vigente
        (Cámara {feeCamara.toFixed(2)}% · Interior {(feeInterior ?? feeCamara).toFixed(2)}%) y reajusta los saldos. Queda registrado en auditoría.
      </p>
      <input inputMode="numeric" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} placeholder="Código MFA" className="w-full rounded border border-border bg-background px-2 py-1.5 text-center font-mono text-sm tracking-[0.2em] text-foreground outline-none focus:border-primary" />
      {ok && <p className="text-xs text-primary">✓ Tarifa reaplicada.</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          disabled={pendiente || codigo.length !== 6}
          onClick={() => {
            setError(null); setOk(false);
            startTransition(async () => {
              const r = await reaplicarTarifaCliente({ clienteId, codigo });
              if (r.error) setError(r.error);
              else { setOk(true); setCodigo(""); router.refresh(); }
            });
          }}
          className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary disabled:opacity-50"
        >
          {pendiente ? "Aplicando…" : "Reaplicar"}
        </button>
        <button onClick={() => { setAbierto(false); setError(null); }} className="rounded border border-border px-3 py-1.5 text-xs text-foreground/90">Cancelar</button>
      </div>
    </div>
  );
}
