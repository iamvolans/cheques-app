"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { corregirLiquidacion, anularLiquidacion } from "@/actions/correcciones";

const inp = "rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-emerald-500";
const codeInp = "w-32 rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-center font-mono text-xs tracking-[0.2em] text-zinc-100 outline-none focus:border-emerald-500";

export default function AccionesLiquidacion({ id, monto }: { id: string; monto: number }) {
  const [modo, setModo] = useState<"" | "corregir" | "anular">("");
  const [nuevoMonto, setNuevoMonto] = useState(String(monto));
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  function correr(fn: () => Promise<{ error: string | null; ok?: boolean }>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
      else { setModo(""); setCodigo(""); router.refresh(); }
    });
  }

  if (modo === "corregir") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <input type="number" step="0.01" min="0.01" value={nuevoMonto} onChange={(e) => setNuevoMonto(e.target.value)} className={`${inp} w-32`} placeholder="Nuevo monto" />
        <input inputMode="numeric" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} placeholder="Código MFA" className={codeInp} />
        <button disabled={pendiente || codigo.length !== 6} onClick={() => correr(() => corregirLiquidacion({ liquidacionId: id, nuevoMonto: Number(nuevoMonto), codigo }))} className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50">Guardar</button>
        <button onClick={() => setModo("")} className="rounded border border-zinc-700 px-2 py-1.5 text-xs text-zinc-300">×</button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    );
  }

  if (modo === "anular") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-amber-400">¿Anular y devolver el saldo?</span>
        <input inputMode="numeric" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} placeholder="Código MFA" className={codeInp} />
        <button disabled={pendiente || codigo.length !== 6} onClick={() => correr(() => anularLiquidacion({ liquidacionId: id, codigo }))} className="rounded bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50">Confirmar anulación</button>
        <button onClick={() => setModo("")} className="rounded border border-zinc-700 px-2 py-1.5 text-xs text-zinc-300">×</button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button onClick={() => setModo("corregir")} className="rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800">Corregir</button>
      <button onClick={() => setModo("anular")} className="rounded border border-red-900 px-2.5 py-1 text-xs text-red-300 hover:bg-red-950">Anular</button>
    </div>
  );
}
