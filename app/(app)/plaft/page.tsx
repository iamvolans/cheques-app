import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Monitoreo · PLAFT" };

const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const enM = (n: number) => `$${(n / 1000000).toLocaleString("es-AR", { maximumFractionDigits: 1 })}M`;

function ChipBanda({ banda, score }: { banda: string; score: number }) {
  const estilo: Record<string, string> = {
    critico: "bg-danger text-danger-foreground",
    alerta: "bg-warning-muted text-warning",
    observacion: "bg-info-muted text-info",
    normal: "bg-success-muted text-primary",
  };
  const etiqueta: Record<string, string> = {
    critico: "Crítico", alerta: "Alerta", observacion: "Observación", normal: "Normal",
  };
  return (
    <span className={`inline-flex min-w-[5.5rem] items-center justify-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold leading-none ${estilo[banda] ?? "bg-muted text-muted-foreground"}`}>
      <span className="font-mono">{score}</span> · {etiqueta[banda] ?? banda}
    </span>
  );
}

export default async function PlaftPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal1") redirect("/mfa-setup");
  if (aal?.currentLevel !== "aal2") redirect("/mfa-verify");

  const [{ data: scores }, { data: compartidos }, { data: mesActual }, { data: params }] = await Promise.all([
    supabase.from("vw_plaft_score_cliente").select("*").order("score_plaft", { ascending: false }),
    supabase.from("vw_plaft_destinos").select("*").gte("clientes_distintos", 2).order("total_recibido", { ascending: false }),
    supabase.from("vw_plaft_destino_mes_actual").select("*").order("acumulado_mes", { ascending: false }).limit(15),
    supabase.from("plaft_parametros").select("*").eq("id", 1).maybeSingle(),
  ]);

  const umbralF = Number(params?.umbral_mensual_fisica ?? 10000000);
  const umbralJ = Number(params?.umbral_mensual_juridica ?? 50000000);

  const seccion = "rounded-2xl border border-border bg-gradient-to-b from-card to-background shadow-lg shadow-foreground/5";
  const cabecera = "border-b border-border px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground";
  const th = "px-3 py-2.5 font-medium";

  return (
    <main className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="border-b border-border pb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Monitoreo · PLAFT</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitoreo transaccional de liquidaciones: score por cliente, destinos compartidos y acumulados del mes contra umbral.
            Umbrales vigentes: <span className="font-mono text-foreground/90">{enM(umbralF)}</span>/mes persona física · <span className="font-mono text-foreground/90">{enM(umbralJ)}</span>/mes empresa.
          </p>
        </header>

        {/* 1 · Ranking de clientes por score PLAFT */}
        <section className={seccion}>
          <p className={cabecera}>Score PLAFT por cliente · señales sobre el total histórico de liquidaciones</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className={`${th} text-center`}>Score</th>
                  <th className={th}>Cliente</th>
                  <th className={`${th} text-right`}>Liquidado</th>
                  <th className={`${th} text-right`}>Transf.</th>
                  <th className={`${th} text-right`} title="Mayor % de sus liquidaciones hacia un solo destino (solo destinos con más de $10M)">Conc. máx</th>
                  <th className={`${th} text-right`} title="Destinos que también reciben de otros clientes">Dest. compartidos</th>
                  <th className={`${th} text-right`} title="Total enviado a personas físicas">A pers. físicas</th>
                  <th className={`${th} text-right`} title="Días con 2+ transferencias al mismo destino por más de $10M">Fraccionam.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(scores ?? []).map((s) => (
                  <tr key={s.cliente_id} className="transition hover:bg-muted/40">
                    <td className="px-3 py-2.5 text-center"><ChipBanda banda={s.banda_plaft} score={Number(s.score_plaft)} /></td>
                    <td className="px-3 py-2.5 text-foreground">{s.cliente}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-foreground/90">{enM(Number(s.total_liquidado))}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{s.transferencias}</td>
                    <td className={`px-3 py-2.5 text-right font-mono ${Number(s.max_concentracion_pct) >= 50 ? "text-danger" : Number(s.max_concentracion_pct) >= 30 ? "text-warning" : "text-foreground/90"}`}>
                      {Number(s.max_concentracion_pct).toFixed(1)}%
                    </td>
                    <td className={`px-3 py-2.5 text-right font-mono ${Number(s.destinos_compartidos) >= 3 ? "text-warning" : "text-foreground/90"}`}>{s.destinos_compartidos}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-foreground/90">{enM(Number(s.total_a_fisicas))}</td>
                    <td className={`px-3 py-2.5 text-right font-mono ${Number(s.episodios_fraccionamiento) >= 1 ? "text-warning" : "text-foreground/90"}`}>{s.episodios_fraccionamiento}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-5 py-3 text-[11px] text-muted-foreground/70">
            Señales: concentración de destino (hasta 30 pts) · destinos compartidos entre clientes (hasta 25) · envíos a personas físicas (hasta 25) · fraccionamiento mismo día (hasta 20).
            Bandas: Normal 0-20 · Observación 21-45 · Alerta 46-70 · Crítico 71-100.
          </p>
        </section>

        {/* 2 · Destinos compartidos entre clientes */}
        <section className={seccion}>
          <p className={cabecera}>Destinos que reciben de 2 o más clientes distintos · posible operatoria vinculada</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className={th}>Beneficiario</th>
                  <th className={th}>CUIT</th>
                  <th className={th}>Tipo</th>
                  <th className={`${th} text-right`}>Clientes</th>
                  <th className={`${th} text-right`}>Transf.</th>
                  <th className={`${th} text-right`}>Total recibido</th>
                  <th className={th}>Período</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(compartidos ?? []).map((d) => (
                  <tr key={d.destino_cbu} className="transition hover:bg-muted/40">
                    <td className="px-3 py-2.5 text-foreground">{d.beneficiario ?? "—"}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{d.cuit_destino}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full whitespace-nowrap px-2 py-0.5 text-[10px] font-semibold uppercase ${d.tipo_persona === "fisica" ? "bg-warning-muted text-warning" : "bg-info-muted text-info"}`}>
                        {d.tipo_persona === "fisica" ? "P. física" : d.tipo_persona === "juridica" ? "Empresa" : "?"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-warning">{d.clientes_distintos}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{d.transferencias}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-primary">{ars.format(Number(d.total_recibido))}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{String(d.primera)} → {String(d.ultima)}</td>
                  </tr>
                ))}
                {(compartidos ?? []).length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">Sin destinos compartidos entre clientes.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 3 · Acumulado del mes corriente vs umbral */}
        <section className={seccion}>
          <p className={cabecera}>Acumulado del mes corriente por destino · contra umbral PLAFT</p>
          <div className="space-y-3 px-5 py-4">
            {(mesActual ?? []).map((d) => {
              const umbral = d.tipo_persona === "fisica" ? umbralF : umbralJ;
              const pct = umbral > 0 ? (Number(d.acumulado_mes) / umbral) * 100 : 0;
              const color = pct >= 100 ? "bg-danger" : pct >= 60 ? "bg-warning" : "bg-primary";
              const texto = pct >= 100 ? "text-danger" : pct >= 60 ? "text-warning" : "text-primary";
              return (
                <div key={d.destino_cbu} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate text-foreground">
                      {d.beneficiario ?? "—"}
                      <span className="ml-2 text-[10px] uppercase text-muted-foreground">{d.tipo_persona === "fisica" ? "P. física" : "Empresa"}</span>
                      {Number(d.clientes_mes) > 1 && <span className="ml-2 rounded-full bg-warning-muted px-2 py-0.5 text-[10px] font-semibold text-warning">recibe de {d.clientes_mes} clientes ⚠</span>}
                    </span>
                    <span className="flex shrink-0 items-baseline gap-3 font-mono text-sm">
                      <span className="text-muted-foreground">{ars.format(Number(d.acumulado_mes))}</span>
                      <span className={`w-16 text-right font-semibold ${texto}`}>{pct.toFixed(0)}%</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted/50">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>
              );
            })}
            {(mesActual ?? []).length === 0 && <p className="py-4 text-sm text-muted-foreground">Sin liquidaciones este mes.</p>}
          </div>
          <p className="px-5 pb-4 text-[11px] text-muted-foreground/70">
            El % es contra el umbral según tipo de persona. Los umbrales se editan en Configuración. Los mismos datos alimentan el aviso al cargar o aprobar una liquidación.
          </p>
        </section>
      </div>
    </main>
  );
}
