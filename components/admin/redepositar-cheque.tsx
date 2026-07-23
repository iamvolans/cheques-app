"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { redepositarCheque } from "@/actions/correcciones";
import { RotateCcw } from "lucide-react";

export default function RedepositarCheque({ chequeId, numero }: { chequeId: string; numero: string }) {
  const [abierto, setAbierto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  return (
    <section className="rounded-2xl border border-border bg-card/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-info/10 text-info">
            <RotateCcw size={17} />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Redepositar cheque</p>
            <p className="text-xs text-muted-foreground">
              Segunda presentación: revierte el débito del rechazo (fee + multa) y vuelve el valor a Depositado.
            </p>
          </div>
        </div>
        {!abierto && (
          <button onClick={() => setAbierto(true)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/90 transition hover:bg-muted">
            Redepositar N° {numero}
          </button>
        )}
      </div>
      {abierto && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            inputMode="numeric"
            maxLength={6}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
            placeholder="Código MFA"
            className="w-32 rounded-lg border border-border bg-background px-3 py-1.5 text-center font-mono text-sm tracking-[0.2em] text-foreground outline-none focus:border-primary"
          />
          <button
            disabled={pendiente || codigo.length !== 6}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const r = await redepositarCheque({ chequeId, codigo });
                if (r.error) setError(r.error);
                else { setAbierto(false); setCodigo(""); router.refresh(); }
              });
            }}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary disabled:opacity-50"
          >
            {pendiente ? "Redepositando…" : "Confirmar redepósito"}
          </button>
          <button onClick={() => { setAbierto(false); setError(null); }} className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/90">Cancelar</button>
          {error && <p className="w-full rounded-lg border border-danger/40 bg-danger-muted px-3 py-2 text-xs text-danger">{error}</p>}
        </div>
      )}
    </section>
  );
}
