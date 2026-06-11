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
    window.location.href = qs ? `${endpoint}?${qs}` : endpoint;
  }

  const inp = "rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-emerald-500";

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-zinc-500">
        Desde
        <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={inp} />
      </label>
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-zinc-500">
        Hasta
        <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={inp} />
      </label>
      <button
        onClick={descargar}
        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700/60 bg-emerald-600/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-600/20"
      >
        <Download size={13} /> Exportar XLS
      </button>
    </div>
  );
}
