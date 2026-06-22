"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ajustarSaldoManual } from "@/actions/correcciones";
import { Scale } from "lucide-react";

export default function AjusteSaldo({ clienteId }: { clienteId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [signo, setSigno] = useState<"sumar" | "restar">("sumar");
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  const inp = "rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-emerald-500";

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800">
        <Scale size={13} /> Ajuste manual de saldo
      </button>
    );
  }

  return (
    <div className="grid w-96 gap-2 rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-left">
      <p className="text-xs font-medium text-zinc-300">Ajuste manual de saldo</p>
      <p className="text-[10px] text-zinc-500">Crea un movimiento de corrección. Requiere motivo y código MFA. Queda en auditoría.</p>
      <div className="flex gap-2">
        <select value={signo} onChange={(e) => setSigno(e.target.value as "sumar" | "restar")} className={inp}>
          <option value="sumar">Sumar (+)</option>
          <option value="restar">Restar (−)</option>
        </select>
        <input type="number" step="0.01" min="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="Monto" className={`${inp} flex-1`} />
      </div>
      <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo del ajuste (obligatorio)" className={inp} />
      <input inputMode="numeric" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} placeholder="Código MFA" className={`${inp} text-center font-mono tracking-[0.2em]`} />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          disabled={pendiente || codigo.length !== 6 || !monto || !motivo.trim()}
          onClick={() => {
            setError(null);
            const valor = (signo === "restar" ? -1 : 1) * Math.abs(Number(monto));
            startTransition(async () => {
              const r = await ajustarSaldoManual({ clienteId, monto: valor, motivo, codigo });
              if (r.error) setError(r.error);
              else { setAbierto(false); setMonto(""); setMotivo(""); setCodigo(""); router.refresh(); }
            });
          }}
          className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {pendiente ? "Aplicando…" : "Aplicar ajuste"}
        </button>
        <button onClick={() => { setAbierto(false); setError(null); }} className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300">Cancelar</button>
      </div>
    </div>
  );
}
