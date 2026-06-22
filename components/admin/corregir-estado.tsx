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
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
            <GitBranch size={17} />
          </span>
          <div>
            <p className="text-sm font-semibold text-zinc-200">Corregir estado del cheque</p>
            <p className="text-xs text-zinc-500">Ajusta el saldo del cliente automáticamente. Requiere tu código MFA. Queda en auditoría.</p>
          </div>
        </div>
        {!abierto && (
          <button onClick={() => setAbierto(true)} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800">
            Cambiar estado de N° {numero}
          </button>
        )}
      </div>

      {abierto && (
        <div className="mt-4 grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select value={nuevoEstado} onChange={(e) => setNuevoEstado(e.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-emerald-500">
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
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-emerald-500"
            />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <input inputMode="numeric" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} placeholder="Código MFA" className="w-32 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-center font-mono text-sm tracking-[0.2em] text-zinc-100 outline-none focus:border-emerald-500" />
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
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {pendiente ? "Aplicando…" : "Cambiar estado"}
            </button>
            <button onClick={() => { setAbierto(false); setError(null); }} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300">Cancelar</button>
          </div>
          {error && <p className="rounded-lg border border-red-900 bg-red-950 px-3 py-2 text-xs text-red-300">{error}</p>}
        </div>
      )}
    </section>
  );
}
