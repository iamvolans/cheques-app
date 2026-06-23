"use client";

import { useState } from "react";
import { Download } from "lucide-react";

export default function DescargarExtracto({ token }: { token: string }) {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const url = () => {
    const p = new URLSearchParams({ token });
    if (desde) p.set("desde", desde);
    if (hasta) p.set("hasta", hasta);
    return "/api/portal/extracto?" + p.toString();
  };

  const inp = "rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary";
  const btn = "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary/90";

  return (
    <section className="rounded-2xl border border-border bg-card/50 p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Descargar extracto de cuenta</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          Desde
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={inp} />
        </label>
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          Hasta
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={inp} />
        </label>
        <a href={url()} className={btn}><Download size={13} /> Descargar XLS</a>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">Dejá las fechas vacías para descargar todo el historial. El extracto incluye todos los movimientos con saldo acumulado.</p>
    </section>
  );
}
