"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

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

  const btn = "rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/90 transition hover:bg-muted";
  const off = "pointer-events-none opacity-40";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-3">
      {resumen}
      <div className="flex items-center gap-2">
        <Link href={url(pagina - 1)} className={`${btn} ${pagina <= 1 ? off : ""}`}>← Anterior</Link>
        <span className="text-xs text-muted-foreground">Página {pagina} de {totalPaginas}</span>
        <Link href={url(pagina + 1)} className={`${btn} ${pagina >= totalPaginas ? off : ""}`}>Siguiente →</Link>
      </div>
    </div>
  );
}
