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

  const inp = "rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary";

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/90 transition hover:bg-muted">
        <Scale size={13} /> Ajuste manual de saldo
      </button>
    );
  }

  return (
    <div className="grid w-96 gap-2 rounded-lg border border-border bg-card p-3 text-left">
      <p className="text-xs font-medium text-foreground/90">Ajuste manual de saldo</p>
      <p className="text-[10px] text-muted-foreground">Crea un movimiento de corrección. Requiere motivo y código MFA. Queda en auditoría.</p>
      <div className="flex gap-2">
        <select value={signo} onChange={(e) => setSigno(e.target.value as "sumar" | "restar")} className={inp}>
          <option value="sumar">Sumar (+)</option>
          <option value="restar">Restar (−)</option>
        </select>
        <input type="number" step="0.01" min="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="Monto" className={`${inp} flex-1`} />
      </div>
      <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo del ajuste (obligatorio)" className={inp} />
      <input inputMode="numeric" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} placeholder="Código MFA" className={`${inp} text-center font-mono tracking-[0.2em]`} />
      {error && <p className="text-xs text-danger">{error}</p>}
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
          className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary disabled:opacity-50"
        >
          {pendiente ? "Aplicando…" : "Aplicar ajuste"}
        </button>
        <button onClick={() => { setAbierto(false); setError(null); }} className="rounded border border-border px-3 py-1.5 text-xs text-foreground/90">Cancelar</button>
      </div>
    </div>
  );
}
