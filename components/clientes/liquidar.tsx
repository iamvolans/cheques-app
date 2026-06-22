"use client";

import { useActionState, useEffect, useState } from "react";
import { liquidar, type EstadoLiq } from "@/actions/liquidaciones";
import InputCuit from "@/components/ui/input-cuit";
import InputMonto from "@/components/ui/input-monto";

const inicial: EstadoLiq = { error: null };

export default function Liquidar({
  clienteId,
  saldo,
}: {
  clienteId: string;
  saldo: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState(liquidar, inicial);

  useEffect(() => {
    if (estado.ok) setAbierto(false);
  }, [estado]);

  if (saldo <= 0) return null;

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="rounded bg-primary px-3 py-1 text-xs font-medium text-white transition hover:bg-primary"
      >
        Liquidar
      </button>
    );
  }

  const inputCls =
    "w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/15";

  return (
    <form action={accion} className="grid w-80 gap-2 rounded-lg border border-border bg-card p-3 text-left">
      <input type="hidden" name="cliente_id" value={clienteId} />
      <input name="coelsa_id" placeholder="Coelsa ID *" required className={inputCls} />
      <input name="fecha_transferencia" type="date" required className={inputCls} title="Fecha de transferencia" />
      <input name="cvu_cbu_destino" placeholder="CBU/CVU destino (22 dígitos)" className={inputCls} />
      <input name="alias_destino" placeholder="Alias destino" className={inputCls} />
      <p className="text-[10px] text-muted-foreground">CBU/CVU o Alias: cargá al menos uno (pueden ser los dos).</p>
      <input name="beneficiario" placeholder="Razón Social / Beneficiario *" required className={inputCls} />
      <InputCuit name="cuit_beneficiario" placeholder="CUIT del beneficiario *" required className={inputCls} />
      <InputMonto
        name="monto_liquidado"
        required
        className={inputCls}
        placeholder={`Monto a liquidar (hasta $${saldo.toLocaleString("es-AR")})`}
      />

      {estado.error && (
        <p className="rounded border border-danger/40 bg-danger-muted px-2 py-1 text-xs text-danger">
          {estado.error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary disabled:opacity-50"
        >
          {pendiente ? "Registrando…" : "Confirmar transferencia"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded border border-border px-3 py-1.5 text-xs text-foreground/90"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
