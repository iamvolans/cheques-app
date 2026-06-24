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
    supabase.from("vw_libradores_score").select("*").order("score_riesgo", { ascending: false }),
    supabase.from("vw_kpi_clientes").select("*").order("pct_rechazo", { ascending: false }),
  ]);

  const fmtARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

  return (
    <main className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-10">
        <header className="border-b border-border pb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Libradores · Riesgo</h1>
          
        </header>

        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Acumulador por CUIT librador
          </h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-card/80 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 text-center font-medium">Score</th>
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
              <tbody className="divide-y divide-border bg-background">
                {(libradores ?? []).map((l) => (
                  <tr key={l.cuit_librador} className="transition hover:bg-muted/40">
                    <td className="px-3 py-3 text-center">
                      {(() => {
                        const banda = l.banda_riesgo as string;
                        const estilo: Record<string, string> = {
                          critico: "bg-danger text-danger-foreground",
                          alto: "bg-warning text-warning-foreground",
                          medio: "bg-info-muted text-info",
                          bajo: "bg-success-muted text-primary",
                          sin_historial: "bg-muted text-muted-foreground",
                        };
                        const etiqueta: Record<string, string> = {
                          critico: "Crítico", alto: "Alto", medio: "Medio",
                          bajo: "Bajo", sin_historial: "Nuevo",
                        };
                        return (
                          <span className={`inline-flex min-w-[3.5rem] items-center justify-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${estilo[banda] ?? "bg-muted text-muted-foreground"}`} title={`Score de riesgo: ${l.score_riesgo}/100`}>
                            <span className="font-mono">{l.score_riesgo}</span> · {etiqueta[banda] ?? banda}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-3 text-foreground">
                      {l.en_lista_negra && (
                        <span className="mr-1 rounded bg-danger-muted px-1.5 py-0.5 text-xs font-semibold text-danger">
                          LISTA NEGRA
                        </span>
                      )}
                      {l.librador}
                    </td>
                    <td className="px-3 py-3 font-mono text-muted-foreground">{l.cuit_librador}</td>
                    <td className="px-3 py-3 text-right font-mono text-foreground/90">{l.total_cheques}</td>
                    <td className="px-3 py-3 text-right font-mono text-foreground">
                      {fmtARS.format(Number(l.monto_total_gestionado))}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-muted-foreground">
                      {fmtARS.format(Number(l.monto_ultimos_30d ?? 0))}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-foreground/90">{l.cheques_rechazados}</td>
                    <td className={`px-3 py-3 text-right font-mono font-semibold ${
                      Number(l.pct_rechazo) >= 20 ? "text-danger"
                      : Number(l.pct_rechazo) > 0 ? "text-warning"
                      : "text-primary"
                    }`}>
                      {Number(l.pct_rechazo).toFixed(1)}%
                    </td>
                    <td className="px-3 py-3 font-mono text-muted-foreground">
                      {l.fecha_ultimo_rechazo
                        ? new Date(l.fecha_ultimo_rechazo).toLocaleDateString("es-AR")
                        : "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-muted-foreground">
                      {l.mayor_monto_rechazado ? fmtARS.format(Number(l.mayor_monto_rechazado)) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            KPI por cliente — ¿quién trae los rechazos?
          </h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-card/80 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 font-medium">Cliente</th>
                  <th className="px-3 py-3 text-right font-medium">Cheques traídos</th>
                  <th className="px-3 py-3 text-right font-medium">Monto total</th>
                  <th className="px-3 py-3 text-right font-medium">Rechazados</th>
                  <th className="px-3 py-3 text-right font-medium">Monto rechazado</th>
                  <th className="px-3 py-3 text-right font-medium">% Rechazo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {(kpiClientes ?? []).map((k) => (
                  <tr key={k.cliente_id} className="transition hover:bg-muted/40">
                    <td className="px-3 py-3 text-foreground">{k.razon_social}</td>
                    <td className="px-3 py-3 text-right font-mono text-foreground/90">{k.total_cheques ?? 0}</td>
                    <td className="px-3 py-3 text-right font-mono text-foreground">
                      {fmtARS.format(Number(k.monto_total ?? 0))}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-foreground/90">{k.cheques_rechazados ?? 0}</td>
                    <td className="px-3 py-3 text-right font-mono text-muted-foreground">
                      {fmtARS.format(Number(k.monto_rechazado ?? 0))}
                    </td>
                    <td className={`px-3 py-3 text-right font-mono font-semibold ${
                      Number(k.pct_rechazo) >= 20 ? "text-danger"
                      : Number(k.pct_rechazo) > 0 ? "text-warning"
                      : "text-primary"
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
