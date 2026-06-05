import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function LibradoresPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal1") redirect("/mfa-setup");
  if (aal?.currentLevel !== "aal2") redirect("/mfa-verify");

  const [{ data: libradores }, { data: kpiClientes }] = await Promise.all([
    supabase.from("vw_libradores_stats").select("*").order("pct_rechazo", { ascending: false }),
    supabase.from("vw_kpi_clientes").select("*").order("pct_rechazo", { ascending: false }),
  ]);

  const fmtARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

  return (
    <main className="min-h-screen bg-zinc-950 p-4 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-10">
        <header className="border-b border-zinc-800 pb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Libradores · Riesgo</h1>
          
        </header>

        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-400">
            Acumulador por CUIT librador
          </h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/80 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-3 py-3 font-medium">Librador</th>
                  <th className="px-3 py-3 font-medium">CUIT</th>
                  <th className="px-3 py-3 text-right font-medium">Cheques</th>
                  <th className="px-3 py-3 text-right font-medium">Total gestionado</th>
                  <th className="px-3 py-3 text-right font-medium">Últimos 30 días</th>
                  <th className="px-3 py-3 text-right font-medium">Rechazos</th>
                  <th className="px-3 py-3 text-right font-medium">% Rechazo</th>
                  <th className="px-3 py-3 font-medium">Último rechazo</th>
                  <th className="px-3 py-3 text-right font-medium">Mayor monto rechazado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 bg-zinc-950">
                {(libradores ?? []).map((l) => (
                  <tr key={l.cuit_librador} className="transition hover:bg-zinc-800/40">
                    <td className="px-3 py-3 text-zinc-100">
                      {l.en_lista_negra && (
                        <span className="mr-1 rounded bg-red-950 px-1.5 py-0.5 text-xs font-semibold text-red-300">
                          LISTA NEGRA
                        </span>
                      )}
                      {l.librador}
                    </td>
                    <td className="px-3 py-3 font-mono text-zinc-400">{l.cuit_librador}</td>
                    <td className="px-3 py-3 text-right font-mono text-zinc-300">{l.total_cheques}</td>
                    <td className="px-3 py-3 text-right font-mono text-zinc-100">
                      {fmtARS.format(Number(l.monto_total_gestionado))}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-zinc-400">
                      {fmtARS.format(Number(l.monto_ultimos_30d ?? 0))}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-zinc-300">{l.cheques_rechazados}</td>
                    <td className={`px-3 py-3 text-right font-mono font-semibold ${
                      Number(l.pct_rechazo) >= 20 ? "text-red-400"
                      : Number(l.pct_rechazo) > 0 ? "text-amber-400"
                      : "text-emerald-400"
                    }`}>
                      {Number(l.pct_rechazo).toFixed(1)}%
                    </td>
                    <td className="px-3 py-3 font-mono text-zinc-400">
                      {l.fecha_ultimo_rechazo
                        ? new Date(l.fecha_ultimo_rechazo).toLocaleDateString("es-AR")
                        : "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-zinc-400">
                      {l.mayor_monto_rechazado ? fmtARS.format(Number(l.mayor_monto_rechazado)) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-400">
            KPI por cliente — ¿quién trae los rechazos?
          </h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/80 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-3 py-3 font-medium">Cliente</th>
                  <th className="px-3 py-3 text-right font-medium">Cheques traídos</th>
                  <th className="px-3 py-3 text-right font-medium">Monto total</th>
                  <th className="px-3 py-3 text-right font-medium">Rechazados</th>
                  <th className="px-3 py-3 text-right font-medium">Monto rechazado</th>
                  <th className="px-3 py-3 text-right font-medium">% Rechazo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 bg-zinc-950">
                {(kpiClientes ?? []).map((k) => (
                  <tr key={k.cliente_id} className="transition hover:bg-zinc-800/40">
                    <td className="px-3 py-3 text-zinc-100">{k.razon_social}</td>
                    <td className="px-3 py-3 text-right font-mono text-zinc-300">{k.total_cheques ?? 0}</td>
                    <td className="px-3 py-3 text-right font-mono text-zinc-100">
                      {fmtARS.format(Number(k.monto_total ?? 0))}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-zinc-300">{k.cheques_rechazados ?? 0}</td>
                    <td className="px-3 py-3 text-right font-mono text-zinc-400">
                      {fmtARS.format(Number(k.monto_rechazado ?? 0))}
                    </td>
                    <td className={`px-3 py-3 text-right font-mono font-semibold ${
                      Number(k.pct_rechazo) >= 20 ? "text-red-400"
                      : Number(k.pct_rechazo) > 0 ? "text-amber-400"
                      : "text-emerald-400"
                    }`}>
                      {k.pct_rechazo != null ? Number(k.pct_rechazo).toFixed(1) + "%" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
