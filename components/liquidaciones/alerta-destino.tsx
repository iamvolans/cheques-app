"use client";

import { useEffect, useState } from "react";
import { consultarDestinoLiquidacion, type DestinoPlaft } from "@/actions/plaft";
import { ShieldAlert, ShieldCheck, Ban, Loader2 } from "lucide-react";

const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export default function AlertaDestino({ cuit }: { cuit: string }) {
  const [d, setD] = useState<DestinoPlaft | null>(null);
  const [cargando, setCargando] = useState(false);
  const digitos = (cuit ?? "").replace(/\D/g, "");

  useEffect(() => {
    if (digitos.length !== 11) { setD(null); return; }
    let cancelado = false;
    setCargando(true);
    const t = setTimeout(async () => {
      const r = await consultarDestinoLiquidacion(digitos);
      if (cancelado) return;
      setD(r.destino ?? null);
      setCargando(false);
    }, 500);
    return () => { cancelado = true; clearTimeout(t); };
  }, [digitos]);

  if (digitos.length !== 11) return null;
  if (cargando && !d) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
        <Loader2 size={13} className="animate-spin" /> Consultando acumulado del destino…
      </div>
    );
  }
  if (!d) return null;

  const tipoTxt = d.tipoPersona === "fisica" ? "persona física" : d.tipoPersona === "juridica" ? "empresa" : "tipo desconocido";

  if (d.bloqueado) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-danger/50 bg-danger-muted px-3 py-2 text-[11px] text-danger">
        <Ban size={14} className="mt-0.5 shrink-0" />
        <span><strong className="font-semibold">⛔ DESTINO BLOQUEADO.</strong> Este CUIT está en la lista de destinos bloqueados. No liquidar sin autorización del Oficial de Cumplimiento.</span>
      </div>
    );
  }

  const tono = d.pct >= 100
    ? { box: "border-danger/50 bg-danger-muted text-danger", icon: <ShieldAlert size={14} className="mt-0.5 shrink-0" />, titulo: "Umbral mensual superado" }
    : d.pct >= 60
    ? { box: "border-warning/50 bg-warning-muted text-warning", icon: <ShieldAlert size={14} className="mt-0.5 shrink-0" />, titulo: "Acercándose al umbral" }
    : { box: "border-primary/40 bg-success-muted text-primary", icon: <ShieldCheck size={14} className="mt-0.5 shrink-0" />, titulo: "Dentro del umbral" };

  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px] ${tono.box}`}>
      {tono.icon}
      <span>
        <strong className="font-semibold">{tono.titulo}.</strong>{" "}
        Este destino ({tipoTxt}) acumula {fmt.format(d.acumuladoMes)} este mes ({d.pct.toFixed(0)}% del umbral de {fmt.format(d.umbral)})
        {" "}· {d.transferenciasMes} {d.transferenciasMes === 1 ? "transferencia" : "transferencias"}
        {d.clientesMes > 1 && <strong className="font-semibold"> · recibe de {d.clientesMes} clientes distintos ⚠</strong>}.
      </span>
    </div>
  );
}
