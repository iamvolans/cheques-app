import { createClient } from "@/lib/supabase/server";
import FilaSolicitud from "@/components/liquidaciones/fila-solicitud";

export default async function SolicitudesPendientes() {
  const supabase = await createClient();
  const { data: solicitudes } = await supabase
    .from("solicitudes_liquidacion")
    .select("*, clientes(razon_social)")
    .eq("estado", "pendiente")
    .order("created_at");

  if (!solicitudes || solicitudes.length === 0) return null;

  const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
  const rel = (x: unknown) => (x as { razon_social?: string } | null)?.razon_social ?? "—";

  return (
    <section className="mb-6 rounded-2xl border border-warning/40/60 bg-warning-muted/20 shadow-lg shadow-foreground/5">
      <p className="border-b border-amber-900/40 px-5 py-3 text-xs font-medium uppercase tracking-wide text-warning">
        Solicitudes de liquidación pendientes · {solicitudes.length}
      </p>
      <div className="divide-y divide-border">
        {solicitudes.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
            <div className="min-w-0">
              <p className="text-foreground">
                <span className="font-semibold">{rel(s.clientes)}</span> solicita{" "}
                <span className="font-mono text-primary">{fmt.format(Number(s.monto))}</span> → {s.beneficiario}
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                {s.cvu_cbu_destino ?? s.alias_destino}
                {s.cuit_beneficiario && ` · CUIT ${s.cuit_beneficiario}`}
                {s.nota && ` · "${s.nota}"`} · {new Date(s.created_at).toLocaleString("es-AR")}
              </p>
            </div>
            <FilaSolicitud id={s.id} />
          </div>
        ))}
      </div>
    </section>
  );
}
