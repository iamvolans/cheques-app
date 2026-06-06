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
    <section className="mb-6 overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/50 shadow-lg shadow-black/20">
      <p className="border-b border-zinc-800 px-5 py-3 text-xs font-medium uppercase tracking-wide text-zinc-400">
        Concentración por destino · acumulado transferido por CUIT
      </p>
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-500">
            <th className="px-5 py-2.5 font-medium">Destino</th>
            <th className="px-3 py-2.5 font-medium">CUIT</th>
            <th className="px-3 py-2.5 font-medium">Tipo</th>
            <th className="px-3 py-2.5 text-right font-medium">Acumulado</th>
            <th className="px-3 py-2.5 text-right font-medium">Transf.</th>
            <th className="px-3 py-2.5 font-medium">Última</th>
            {esAdmin && <th className="px-3 py-2.5 font-medium">Control</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/70">
          {filas.map((f) => {
            const bloqueado = setBloq.has(limpiar(f.cuit));
            return (
              <tr key={f.cuit} className={bloqueado ? "opacity-70" : ""}>
                <td className="px-5 py-2.5 text-zinc-100">
                  {f.beneficiario}
                  {bloqueado && (
                    <span className="ml-2 rounded-full whitespace-nowrap bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-300">
                      Bloqueado
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 font-mono text-zinc-400">{f.cuit}</td>
                <td className="px-3 py-2.5">
                  <span className={`rounded-full whitespace-nowrap px-2 py-0.5 text-[10px] font-semibold uppercase ${esPF(f.cuit) ? "bg-violet-500/10 text-violet-300" : "bg-blue-500/10 text-blue-300"}`}>
                    {esPF(f.cuit) ? "Persona física" : "Empresa"}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-emerald-300">{fmt.format(f.total)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-zinc-300">{f.cant}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-zinc-500">{f.ultima}</td>
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
