"use client";

import { useState } from "react";
import { Download } from "lucide-react";

export default function ExportarXls({ endpoint }: { endpoint: string }) {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  function descargar() {
    const q = new URLSearchParams();
    if (desde) q.set("desde", desde);
    if (hasta) q.set("hasta", hasta);
    const qs = q.toString();
    const sep = endpoint.includes("?") ? "&" : "?";
    window.location.href = qs ? `${endpoint}${sep}${qs}` : endpoint;
  }

  const inp = "rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary";

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        Desde
        <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={inp} />
      </label>
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        Hasta
        <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={inp} />
      </label>
      <button
        onClick={descargar}
        className="inline-flex items-center gap-1.5 rounded-lg border border-primary/60 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/20"
      >
        <Download size={13} /> Exportar XLS
      </button>
    </div>
  );
}
