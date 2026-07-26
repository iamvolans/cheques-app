import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Métricas" };

const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });
const pct = (x: number, base: number) => (base > 0 ? ((x / base) * 100).toFixed(1) : "0.0");

function Recuadro({ titulo, importe, cant, porc, base, tono = "text-foreground" }: {
  titulo: string; importe: number; cant?: number; porc?: string; base?: string; tono?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-gradient-to-b from-card to-background p-5 shadow-lg shadow-foreground/5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <p className={`metric mt-1 ${String(ars.format(importe)).length > 17 ? "text-xl" : "metric-lg"} ${tono}`}>{ars.format(importe)}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {cant != null && <>{cant.toLocaleString("es-AR")} cheques</>}
        {porc != null && <span className="ml-2 font-mono text-foreground/90">{porc}%</span>}
        {base && <span className="ml-1 text-[11px] text-muted-foreground/70">de {base}</span>}
      </p>
    </div>
  );
}

export default async function MetricasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal1") redirect("/mfa-setup");
  if (aal?.currentLevel !== "aal2") redirect("/mfa-verify");

  const [{ data: g }, { data: gan }] = await Promise.all([
    supabase.from("vw_metricas_general").select("*").single(),
    supabase.from("vw_metricas_ganancia").select("*").single(),
  ]);
  if (!g || !gan) return <main className="p-8 text-muted-foreground">Sin datos de métricas.</main>;

  const N = (x: unknown) => Number(x ?? 0);
  const titulo = "text-xs font-medium uppercase tracking-wide text-muted-foreground";
  const grilla = "grid gap-4 sm:grid-cols-2 lg:grid-cols-4";

  const ticket = N(g.enviados_cant) > 0 ? N(g.enviados_importe) / N(g.enviados_cant) : 0;
  const ganTotal = N(gan.ganancia_total);

  return (
    <main className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="border-b border-border pb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Métricas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Totales históricos de la operación. Porcentajes calculados sobre la base que indica cada recuadro.
          </p>
        </header>

        <section className="space-y-3">
          <p className={titulo}>Estado general · base: total cargado al sistema</p>
          <div className={grilla}>
            <Recuadro titulo="Cargados" importe={N(g.cargados_importe)} cant={N(g.cargados_cant)} tono="text-primary" />
            <Recuadro titulo="Depositados (enviados al banco)" importe={N(g.enviados_importe)} cant={N(g.enviados_cant)} porc={pct(N(g.enviados_importe), N(g.cargados_importe))} base="cargados" />
            <Recuadro titulo="En cartera" importe={N(g.cartera_importe)} cant={N(g.cartera_cant)} porc={pct(N(g.cartera_importe), N(g.cargados_importe))} base="cargados" />
            <Recuadro titulo="En custodia" importe={N(g.custodia_importe)} cant={N(g.custodia_cant)} porc={pct(N(g.custodia_importe), N(g.cargados_importe))} base="cargados" />
          </div>
        </section>

        <section className="space-y-3">
          <p className={titulo}>Enviados al banco · base: total depositado</p>
          <div className={grilla}>
            <Recuadro titulo="Acreditados" importe={N(g.acreditados_importe)} cant={N(g.acreditados_cant)} porc={pct(N(g.acreditados_importe), N(g.enviados_importe))} base="depositados" tono="text-primary" />
            <Recuadro titulo="Rechazados" importe={N(g.rechazados_importe)} cant={N(g.rechazados_cant)} porc={pct(N(g.rechazados_importe), N(g.enviados_importe))} base="depositados" tono="text-danger" />
            <Recuadro titulo="En Clearing" importe={N(g.clearing_importe)} cant={N(g.clearing_cant)} porc={pct(N(g.clearing_importe), N(g.enviados_importe))} base="depositados" tono="text-info" />
            <Recuadro titulo="Ticket promedio" importe={ticket} cant={N(g.enviados_cant)} base="enviados al banco" />
          </div>
        </section>

        <section className="space-y-3">
          <p className={titulo}>Clasificación · base: enviados al banco</p>
          <div className={grilla}>
            <Recuadro titulo="Cámara" importe={N(g.camara_importe)} cant={N(g.camara_cant)} porc={pct(N(g.camara_importe), N(g.enviados_importe))} base="enviados" />
            <Recuadro titulo="Interior" importe={N(g.interior_importe)} cant={N(g.interior_cant)} porc={pct(N(g.interior_importe), N(g.enviados_importe))} base="enviados" />
            <Recuadro titulo="Físicos" importe={N(g.fisico_importe)} cant={N(g.fisico_cant)} porc={pct(N(g.fisico_importe), N(g.enviados_importe))} base="enviados" />
            <Recuadro titulo="E-Cheq" importe={N(g.echeq_importe)} cant={N(g.echeq_cant)} porc={pct(N(g.echeq_importe), N(g.enviados_importe))} base="enviados" />
          </div>
        </section>

        <section className="space-y-3">
          <p className={titulo}>Ganancia · comisiones netas de costo bancario · los tres componentes suman el total</p>
          <div className={grilla}>
            <Recuadro titulo="Ganancia total (neta)" importe={ganTotal} tono="text-primary" />
            <Recuadro titulo="Comisión acreditados (neta)" importe={N(gan.comision_acreditados)} porc={pct(N(gan.comision_acreditados), ganTotal)} base="ganancia" />
            <Recuadro titulo="Comisión rechazados (neta)" importe={N(gan.comision_rechazados)} porc={pct(N(gan.comision_rechazados), ganTotal)} base="ganancia" />
            <Recuadro titulo="Margen multas de rechazo" importe={N(gan.margen_multas)} porc={pct(N(gan.margen_multas), ganTotal)} base="ganancia" />
          </div>
        </section>
      </div>
    </main>
  );
}
