"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registrarReintegro } from "@/actions/reintegros";

const fmtARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

export default function ReintegroComision({
  clienteId,
  cliente,
}: {
  clienteId: string;
  cliente: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [otp, setOtp] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  const valor = Number(monto);
  const listo = valor > 0 && motivo.trim().length >= 3 && otp.trim().length === 6;

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="rounded border border-border px-3 py-1.5 text-xs font-medium text-foreground/90 transition hover:bg-muted"
      >
        Registrar reintegro de comisiones
      </button>
    );
  }

  const inp = "w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary";

  return (
    <div className="grid w-80 gap-2 rounded-lg border border-border bg-card p-3 text-left">
      <p className="text-xs text-muted-foreground">
        Acredita un reintegro de comisiones a <strong>{cliente}</strong> y lo descuenta de la ganancia neta.
      </p>
      <input
        type="number" step="0.01" min="0" placeholder="Monto a reintegrar ARS"
        value={monto} onChange={(e) => setMonto(e.target.value)} className={inp}
      />
      {valor > 0 && (
        <p className="text-[11px] text-muted-foreground">Se acreditarán {fmtARS.format(valor)}.</p>
      )}
      <input
        placeholder="Motivo / concepto (queda en el recibo del portal)"
        value={motivo} onChange={(e) => setMotivo(e.target.value)} className={inp}
      />
      <input
        inputMode="numeric" placeholder="Código de 6 dígitos (2° factor)"
        value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} className={inp}
      />
      {err && <p className="rounded border border-danger/40 bg-danger-muted px-2 py-1 text-xs text-danger">{err}</p>}
      <div className="flex gap-2">
        <button
          disabled={!listo || pendiente}
          onClick={() => {
            setErr(null);
            startTransition(async () => {
              const r = await registrarReintegro({ clienteId, monto: valor, motivo, otp });
              if (r.error) { setErr(r.error); return; }
              setAbierto(false); setMonto(""); setMotivo(""); setOtp("");
              router.refresh();
            });
          }}
          className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-white transition disabled:opacity-50"
        >
          {pendiente ? "Registrando…" : "Confirmar reintegro"}
        </button>
        <button onClick={() => setAbierto(false)} className="rounded border border-border px-3 py-1.5 text-xs text-foreground/90">
          Cancelar
        </button>
      </div>
    </div>
  );
}
