"use client";

import { useEffect, useState } from "react";
import { consultarRiesgoLibrador, type RiesgoLibrador } from "@/actions/riesgo-librador";
import { ShieldAlert, ShieldCheck, ShieldQuestion, Loader2 } from "lucide-react";

export default function AlertaRiesgoLibrador({ cuit }: { cuit: string }) {
  const [riesgo, setRiesgo] = useState<RiesgoLibrador | null>(null);
  const [cargando, setCargando] = useState(false);

  const digitos = (cuit ?? "").replace(/\D/g, "");

  useEffect(() => {
    if (digitos.length !== 11) {
      setRiesgo(null);
      return;
    }
    let cancelado = false;
    setCargando(true);
    const t = setTimeout(async () => {
      const r = await consultarRiesgoLibrador(digitos);
      if (cancelado) return;
      setRiesgo(r.riesgo ?? null);
      setCargando(false);
    }, 500); // debounce: espera a que termine de tipear

    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [digitos]);

  if (digitos.length !== 11) return null;

  if (cargando && !riesgo) {
    return (
      <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-border-subtle bg-muted/40 px-3 py-2 text-[11px] normal-case tracking-normal text-muted-foreground">
        <Loader2 size={13} className="animate-spin" /> Consultando historial del librador…
      </div>
    );
  }

  if (!riesgo) return null;

  // Sin historial
  if (!riesgo.encontrado) {
    return (
      <div className="mt-1.5 flex items-start gap-2 rounded-lg border border-border-subtle bg-muted/40 px-3 py-2 text-[11px] normal-case tracking-normal text-muted-foreground">
        <ShieldQuestion size={14} className="mt-0.5 shrink-0" />
        <span><strong className="font-semibold text-foreground/90">Librador nuevo.</strong> Sin operaciones previas registradas.</span>
      </div>
    );
  }

  // Estilo por banda (suave, usando tokens; crítico más notorio)
  const tono: Record<string, { box: string; icon: React.ReactNode; titulo: string }> = {
    critico: { box: "border-danger/50 bg-danger-muted text-danger", icon: <ShieldAlert size={14} className="mt-0.5 shrink-0" />, titulo: "Riesgo crítico" },
    alto: { box: "border-warning/50 bg-warning-muted text-warning", icon: <ShieldAlert size={14} className="mt-0.5 shrink-0" />, titulo: "Riesgo alto" },
    medio: { box: "border-info/40 bg-info-muted text-info", icon: <ShieldAlert size={14} className="mt-0.5 shrink-0" />, titulo: "Riesgo medio" },
    bajo: { box: "border-primary/40 bg-success-muted text-primary", icon: <ShieldCheck size={14} className="mt-0.5 shrink-0" />, titulo: "Riesgo bajo" },
    sin_historial: { box: "border-border-subtle bg-muted/40 text-muted-foreground", icon: <ShieldQuestion size={14} className="mt-0.5 shrink-0" />, titulo: "Sin historial" },
  };
  const t = tono[riesgo.banda] ?? tono.sin_historial;

  const fechaRech = riesgo.fecha_ultimo_rechazo
    ? new Date(riesgo.fecha_ultimo_rechazo).toLocaleDateString("es-AR")
    : null;

  return (
    <div className={`mt-1.5 flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px] normal-case tracking-normal ${t.box}`}>
      {t.icon}
      <span>
        {riesgo.en_lista_negra && <strong className="font-semibold">⛔ EN LISTA NEGRA. </strong>}
        <strong className="font-semibold">{t.titulo} ({riesgo.score}/100).</strong>{" "}
        {riesgo.total_cheques} {riesgo.total_cheques === 1 ? "cheque previo" : "cheques previos"},{" "}
        {riesgo.cheques_rechazados} {riesgo.cheques_rechazados === 1 ? "rechazado" : "rechazados"} ({riesgo.pct_rechazo.toFixed(0)}%)
        {fechaRech && ` · último rechazo ${fechaRech}`}.
      </span>
    </div>
  );
}
