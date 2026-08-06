"use client";
import { fechaHoraART } from "@/lib/fechas";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { gestionRechazo } from "@/actions/cheques";
import { CheckCircle2, Circle, Printer } from "lucide-react";

const PASOS = [
  { k: "notificado" as const, titulo: "Cliente notificado", desc: "Se le avisó del rechazo" },
  { k: "recuperado" as const, titulo: "Cheque recuperado", desc: "Retirado del banco, en oficina" },
  { k: "entregado" as const, titulo: "Entregado al cliente", desc: "Devuelto con recibo firmado" },
];

export default function GestionRechazo({
  chequeId,
  reciboId,
  notificado,
  recuperado,
  entregado,
}: {
  chequeId: string;
  reciboId: string | null;
  notificado: string | null;
  recuperado: string | null;
  entregado: string | null;
}) {
  const fechas: Record<string, string | null> = { notificado, recuperado, entregado };
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const marcar = (paso: "notificado" | "recuperado" | "entregado") => {
    setError(null);
    startTransition(async () => {
      const r = await gestionRechazo({ chequeId, paso });
      if (r.error) setError(r.error);
      else router.refresh();
    });
  };

  return (
    <section className="rounded-2xl border border-border bg-card/40 p-5">
      <p className="text-sm font-semibold text-foreground">Gestión del cheque físico rechazado</p>
      <p className="text-xs text-muted-foreground">Trazabilidad de la devolución. Cada marca queda en auditoría.</p>
      <div className="mt-4 space-y-2">
        {PASOS.map((p) => {
          const hecho = Boolean(fechas[p.k]);
          const tituloCls = "text-sm " + (hecho ? "text-foreground" : "text-muted-foreground");
          return (
            <div key={p.k} className="flex flex-wrap items-center gap-3 rounded-lg border border-border-subtle bg-background/60 px-3 py-2">
              {hecho
                ? <CheckCircle2 size={16} className="shrink-0 text-primary" />
                : <Circle size={16} className="shrink-0 text-muted-foreground/50" />}
              <div className="min-w-0 flex-1">
                <p className={tituloCls}>{p.titulo}</p>
                <p className="text-[11px] text-muted-foreground/80">
                  {hecho ? fechaHoraART(fechas[p.k] as string) : p.desc}
                </p>
              </div>
              {!hecho && (
                <button
                  disabled={pendiente}
                  onClick={() => marcar(p.k)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/90 transition hover:bg-muted disabled:opacity-50"
                >
                  Marcar
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <a
          href={reciboId ? "/recibos/" + reciboId : "/cheques?estado=rechazado_sin_entregar"}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/60 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/20"
        >
          <Printer size={13} /> {reciboId ? "Ver recibo de devolución" : "Generar recibo desde el listado"}
        </a>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </section>
  );
}
