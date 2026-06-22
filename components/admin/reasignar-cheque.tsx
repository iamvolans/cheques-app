"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reasignarCheque } from "@/actions/correcciones";
import { ArrowLeftRight } from "lucide-react";

export default function ReasignarCheque({
  chequeId,
  numero,
  clienteActualId,
  clientes,
}: {
  chequeId: string;
  numero: string;
  clienteActualId: string;
  clientes: { id: string; razon_social: string }[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [destino, setDestino] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  const opciones = clientes.filter((c) => c.id !== clienteActualId);

  return (
    <section className="rounded-2xl border border-border bg-card/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/10 text-warning">
            <ArrowLeftRight size={17} />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Reasignar a otro cliente</p>
            <p className="text-xs text-muted-foreground">Mueve el cheque y sus movimientos al cliente correcto. Requiere tu código MFA. Queda en auditoría.</p>
          </div>
        </div>
        {!abierto && (
          <button onClick={() => setAbierto(true)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/90 transition hover:bg-muted">
            Reasignar N° {numero}
          </button>
        )}
      </div>

      {abierto && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select value={destino} onChange={(e) => setDestino(e.target.value)} className="min-w-56 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary">
            <option value="">Elegí el cliente destino…</option>
            {opciones.map((c) => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
          </select>
          <input inputMode="numeric" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} placeholder="Código MFA" className="w-32 rounded-lg border border-border bg-background px-3 py-1.5 text-center font-mono text-sm tracking-[0.2em] text-foreground outline-none focus:border-primary" />
          <button
            disabled={pendiente || codigo.length !== 6 || !destino}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const r = await reasignarCheque({ chequeId, nuevoClienteId: destino, codigo });
                if (r.error) setError(r.error);
                else { setAbierto(false); setCodigo(""); setDestino(""); router.refresh(); }
              });
            }}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary disabled:opacity-50"
          >
            {pendiente ? "Reasignando…" : "Reasignar"}
          </button>
          <button onClick={() => { setAbierto(false); setError(null); }} className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/90">Cancelar</button>
          {error && <p className="w-full rounded-lg border border-danger/40 bg-danger-muted px-3 py-2 text-xs text-danger">{error}</p>}
        </div>
      )}
    </section>
  );
}
