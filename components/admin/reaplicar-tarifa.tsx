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
      <button onClick={() => setAbierto(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800">
        <RefreshCw size={13} /> Reaplicar tarifa vigente
      </button>
    );
  }

  return (
    <div className="grid w-80 gap-2 rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-left">
      <p className="text-xs font-medium text-zinc-300">Reaplicar tarifa a todos sus cheques</p>
      <p className="text-[10px] text-zinc-500">
        Recalcula el fee de todos los cheques de este cliente con su tarifa vigente
        (Cámara {feeCamara.toFixed(2)}% · Interior {(feeInterior ?? feeCamara).toFixed(2)}%) y reajusta los saldos. Queda registrado en auditoría.
      </p>
      <input inputMode="numeric" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} placeholder="Código MFA" className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-center font-mono text-sm tracking-[0.2em] text-zinc-100 outline-none focus:border-emerald-500" />
      {ok && <p className="text-xs text-emerald-400">✓ Tarifa reaplicada.</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
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
          className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {pendiente ? "Aplicando…" : "Reaplicar"}
        </button>
        <button onClick={() => { setAbierto(false); setError(null); }} className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300">Cancelar</button>
      </div>
    </div>
  );
}
