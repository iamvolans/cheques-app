"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { corregirEstado } from "@/actions/correcciones";
import { GitBranch } from "lucide-react";

const ESTADOS = [
  { v: "aceptado", l: "Aceptado" },
  { v: "depositado", l: "Depositado" },
  { v: "en_custodia", l: "En custodia" },
  { v: "procesado", l: "Procesado" },
  { v: "rechazado", l: "Rechazado" },
] as const;

export default function CorregirEstado({
  chequeId,
  numero,
  estadoActual,
}: {
  chequeId: string;
  numero: string;
  estadoActual: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [nuevoEstado, setNuevoEstado] = useState(estadoActual);
  const [motivo, setMotivo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  const vaARechazado = nuevoEstado === "rechazado";
  const sinCambio = nuevoEstado === estadoActual;

  return (
    <section className="rounded-2xl border border-border bg-card/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-info/10 text-info">
            <GitBranch size={17} />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Corregir estado del cheque</p>
            <p className="text-xs text-muted-foreground">Ajusta el saldo del cliente automáticamente. Requiere tu código MFA. Queda en auditoría.</p>
          </div>
        </div>
        {!abierto && (
          <button onClick={() => setAbierto(true)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/90 transition hover:bg-muted">
            Cambiar estado de N° {numero}
          </button>
        )}
      </div>

      {abierto && (
        <div className="mt-4 grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select value={nuevoEstado} onChange={(e) => setNuevoEstado(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary">
              {ESTADOS.map((e) => (
                <option key={e.v} value={e.v}>{e.l}{e.v === estadoActual ? " (actual)" : ""}</option>
              ))}
            </select>
          </div>

          {vaARechazado && (
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo del rechazo (obligatorio)"
              className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary"
            />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <input inputMode="numeric" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} placeholder="Código MFA" className="w-32 rounded-lg border border-border bg-background px-3 py-1.5 text-center font-mono text-sm tracking-[0.2em] text-foreground outline-none focus:border-primary" />
            <button
              disabled={pendiente || codigo.length !== 6 || sinCambio || (vaARechazado && !motivo.trim())}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const r = await corregirEstado({
                    chequeId,
                    nuevoEstado: nuevoEstado as "aceptado" | "depositado" | "en_custodia" | "procesado" | "rechazado",
                    motivoRechazo: vaARechazado ? motivo : undefined,
                    codigo,
                  });
                  if (r.error) setError(r.error);
                  else { setAbierto(false); setCodigo(""); setMotivo(""); router.refresh(); }
                });
              }}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary disabled:opacity-50"
            >
              {pendiente ? "Aplicando…" : "Cambiar estado"}
            </button>
            <button onClick={() => { setAbierto(false); setError(null); }} className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/90">Cancelar</button>
          </div>
          {error && <p className="rounded-lg border border-danger/40 bg-danger-muted px-3 py-2 text-xs text-danger">{error}</p>}
        </div>
      )}
    </section>
  );
}
