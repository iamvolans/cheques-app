import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import BotonBloqueo from "@/components/liquidaciones/boton-bloqueo";

export default async function ConcentracionDestinos({ esAdmin }: { esAdmin: boolean }) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const [{ data: liqs }, { data: bloqueados }] = await Promise.all([
    supabase
      .from("liquidaciones")
      .select("cuit_beneficiario, beneficiario, monto_liquidado, fecha_transferencia")
      .not("cuit_beneficiario", "is", null),
    admin.from("cuits_destino_bloqueados").select("cuit"),
  ]);

  if (!liqs || liqs.length === 0) return null;

  const limpiar = (c: string) => c.replace(/\D/g, "");
  const setBloq = new Set((bloqueados ?? []).map((b) => limpiar(b.cuit)));

  const mapa = new Map<
    string,
    { cuit: string; beneficiario: string; total: number; cant: number; ultima: string }
  >();
  for (const l of liqs) {
    const k = limpiar(l.cuit_beneficiario as string);
    const g = mapa.get(k) ?? {
      cuit: l.cuit_beneficiario as string,
      beneficiario: (l.beneficiario as string) ?? "",
      total: 0,
      cant: 0,
      ultima: "",
    };
    g.total += Number(l.monto_liquidado);
    g.cant++;
    if (String(l.fecha_transferencia) > g.ultima) g.ultima = String(l.fecha_transferencia);
    mapa.set(k, g);
  }

  const filas = [...mapa.values()].sort((a, b) => b.total - a.total).slice(0, 15);
  const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
  const esPF = (cuit: string) => ["20", "23", "24", "27"].includes(limpiar(cuit).slice(0, 2));

  return (
    <section className="mb-6 overflow-x-auto rounded-2xl border border-border bg-card/50 shadow-lg shadow-foreground/5">
      <p className="border-b border-border px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Concentración por destino · acumulado transferido por CUIT
      </p>
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-5 py-2.5 font-medium">Destino</th>
            <th className="px-3 py-2.5 font-medium">CUIT</th>
            <th className="px-3 py-2.5 font-medium">Tipo</th>
            <th className="px-3 py-2.5 text-right font-medium">Acumulado</th>
            <th className="px-3 py-2.5 text-right font-medium">Transf.</th>
            <th className="px-3 py-2.5 font-medium">Última</th>
            {esAdmin && <th className="px-3 py-2.5 font-medium">Control</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {filas.map((f) => {
            const bloqueado = setBloq.has(limpiar(f.cuit));
            return (
              <tr key={f.cuit} className={bloqueado ? "opacity-70" : ""}>
                <td className="px-5 py-2.5 text-foreground">
                  {f.beneficiario}
                  {bloqueado && (
                    <span className="ml-2 rounded-full whitespace-nowrap bg-danger/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-danger">
                      Bloqueado
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 font-mono text-muted-foreground">{f.cuit}</td>
                <td className="px-3 py-2.5">
                  <span className={`rounded-full whitespace-nowrap px-2 py-0.5 text-[10px] font-semibold uppercase ${esPF(f.cuit) ? "bg-info/10 text-info" : "bg-info/10 text-info"}`}>
                    {esPF(f.cuit) ? "Persona física" : "Empresa"}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-primary">{fmt.format(f.total)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-foreground/90">{f.cant}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{f.ultima}</td>
                {esAdmin && (
                  <td className="px-3 py-2.5">
                    <BotonBloqueo cuit={f.cuit} bloqueado={bloqueado} />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
