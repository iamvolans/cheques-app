"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function Paginador({
  pagina,
  totalPaginas,
  total,
  totalMonto,
}: {
  pagina: number;
  totalPaginas: number;
  total: number;
  totalMonto?: string;
}) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  const [irA, setIrA] = useState("");

  const url = (p: number) => {
    const q = new URLSearchParams(sp.toString());
    q.set("page", String(p));
    return `${pathname}?${q.toString()}`;
  };

  const resumen = (
    <span className="text-xs text-muted-foreground">
      {total} registro{total === 1 ? "" : "s"}
      {totalMonto && <> · total filtrado <span className="font-mono text-primary">{totalMonto}</span></>}
    </span>
  );

  if (totalPaginas <= 1) {
    return <div className="flex items-center justify-between px-1 py-3">{resumen}</div>;
  }

  // Ventana deslizante de números: hasta 5 páginas centradas en la actual
  const ventana: number[] = [];
  const inicio = Math.max(1, Math.min(pagina - 2, totalPaginas - 4));
  const fin = Math.min(totalPaginas, inicio + 4);
  for (let i = inicio; i <= fin; i++) ventana.push(i);

  const saltar = () => {
    const n = Math.max(1, Math.min(totalPaginas, Number(irA) || 1));
    router.push(url(n));
    setIrA("");
  };

  const btn = "rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground/90 transition hover:bg-muted";
  const btnActivo = "rounded-lg border border-primary bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary";
  const off = "pointer-events-none opacity-40";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-3">
      {resumen}
      <div className="flex flex-wrap items-center gap-1.5">
        <Link href={url(1)} className={`${btn} ${pagina <= 1 ? off : ""}`} title="Primera página">«</Link>
        <Link href={url(pagina - 1)} className={`${btn} ${pagina <= 1 ? off : ""}`} title="Anterior">‹</Link>
        {ventana.map((n) => (
          <Link key={n} href={url(n)} className={n === pagina ? btnActivo : btn}>{n}</Link>
        ))}
        <Link href={url(pagina + 1)} className={`${btn} ${pagina >= totalPaginas ? off : ""}`} title="Siguiente">›</Link>
        <Link href={url(totalPaginas)} className={`${btn} ${pagina >= totalPaginas ? off : ""}`} title="Última página">»</Link>
        <span className="ml-2 flex items-center gap-1">
          <input
            type="number"
            min={1}
            max={totalPaginas}
            value={irA}
            onChange={(e) => setIrA(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saltar(); }}
            placeholder={`${pagina}/${totalPaginas}`}
            className="w-16 rounded-lg border border-border bg-background px-2 py-1.5 text-center text-xs text-foreground outline-none focus:border-primary"
            title="Ir a página"
          />
          <button onClick={saltar} className={btn}>Ir</button>
        </span>
      </div>
    </div>
  );
}
