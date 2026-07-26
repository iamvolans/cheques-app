"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reasignarConvenio } from "@/actions/correcciones";
import { FileSignature } from "lucide-react";

export default function ReasignarConvenio({
  chequeId,
  numero,
  convenios,
}: {
  chequeId: string;
  numero: string;
  convenios: { id: string; razon_social: string }[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [destino, setDestino] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  return (
    <section className="rounded-2xl border border-border bg-card/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-500/10 text-foreground/90">
            <FileSignature size={17} />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Reasignar convenio</p>
            <p className="text-xs text-muted-foreground">Cambia a qué convenio pertenece el cheque. No afecta saldos. Queda en auditoría.</p>
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
          <select value={destino} onChange={(e) => setDestino(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary">
            <option value="">Elegí el convenio destino…</option>
            {convenios.map((c) => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
          </select>
          <button
            disabled={pendiente || !destino}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const r = await reasignarConvenio({ chequeId, nuevoConvenioId: destino });
                if (r.error) setError(r.error);
                else { setAbierto(false); setDestino(""); router.refresh(); }
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
