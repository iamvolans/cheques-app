"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download } from "lucide-react";

export default function ExportarXls({ endpoint }: { endpoint: string }) {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const sp = useSearchParams();

  function descargar() {
    // Arranca con TODOS los filtros activos de la página (q, cliente, estado, importe, tipo, plaza, fechas)
    const q = new URLSearchParams(sp.toString());
    q.delete("page"); // la página de la tabla no aplica al export
    // Los date pickers del botón pisan las fechas de la URL si se completan
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
        title="Exporta lo que estás filtrando en la página"
      >
        <Download size={13} /> Exportar XLS
      </button>
    </div>
  );
}
