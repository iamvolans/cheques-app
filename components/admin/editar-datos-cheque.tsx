"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { editarDatosCheque } from "@/actions/correcciones";
import { Pencil } from "lucide-react";

function fmtCuit(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 10) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

export default function EditarDatosCheque({
  chequeId,
  numero,
  librador,
  cuit,
  banco,
  fechaCobro,
  fechaAcred,
}: {
  chequeId: string;
  numero: string;
  librador: string;
  cuit: string;
  banco: string;
  fechaCobro: string;
  fechaAcred: string | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const [f, setF] = useState({
    librador, cuit: fmtCuit(cuit ?? ""), banco: banco ?? "",
    fechaCobro: fechaCobro ?? "", fechaAcred: fechaAcred ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  const inp = "rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-emerald-500";

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-500/10 text-zinc-300">
            <Pencil size={17} />
          </span>
          <div>
            <p className="text-sm font-semibold text-zinc-200">Editar datos del cheque</p>
            <p className="text-xs text-zinc-500">Librador, CUIT, banco y fechas. No afecta el saldo. Queda en auditoría.</p>
          </div>
        </div>
        {!abierto && (
          <button onClick={() => setAbierto(true)} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800">
            Editar N° {numero}
          </button>
        )}
      </div>

      {abierto && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-zinc-500">Librador
            <input value={f.librador} onChange={(e) => setF({ ...f, librador: e.target.value })} className={inp} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-zinc-500">CUIT
            <input value={f.cuit} onChange={(e) => setF({ ...f, cuit: fmtCuit(e.target.value) })} inputMode="numeric" maxLength={13} className={inp} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-zinc-500">Banco emisor
            <input value={f.banco} onChange={(e) => setF({ ...f, banco: e.target.value })} className={inp} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-zinc-500">Fecha de cobro
            <input type="date" value={f.fechaCobro} onChange={(e) => setF({ ...f, fechaCobro: e.target.value })} className={inp} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-zinc-500">Acreditación estimada
            <input type="date" value={f.fechaAcred} onChange={(e) => setF({ ...f, fechaAcred: e.target.value })} className={inp} />
          </label>
          <div className="flex items-end gap-2">
            <button
              disabled={pendiente}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const r = await editarDatosCheque({
                    chequeId, librador: f.librador, cuit_librador: f.cuit,
                    banco_emisor: f.banco, fecha_cobro: f.fechaCobro,
                    fecha_estimada_acred: f.fechaAcred || null,
                  });
                  if (r.error) setError(r.error);
                  else { setAbierto(false); router.refresh(); }
                });
              }}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {pendiente ? "Guardando…" : "Guardar"}
            </button>
            <button onClick={() => { setAbierto(false); setError(null); }} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300">Cancelar</button>
          </div>
          {error && <p className="sm:col-span-2 rounded-lg border border-red-900 bg-red-950 px-3 py-2 text-xs text-red-300">{error}</p>}
        </div>
      )}
    </section>
  );
}
