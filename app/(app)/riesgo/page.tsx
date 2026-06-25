import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Riesgo · Cartera" };

const fmtARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

function colorSemaforo(pct: number) {
  if (pct >= 50) return { barra: "bg-danger", texto: "text-danger", chip: "bg-danger-muted text-danger" };
  if (pct >= 30) return { barra: "bg-warning", texto: "text-warning", chip: "bg-warning-muted text-warning" };
  return { barra: "bg-primary", texto: "text-primary", chip: "bg-success-muted text-primary" };
}

type Fila = { nombre: string; cheques: number; monto: number; pct: number };

function Seccion({ titulo, descripcion, filas }: { titulo: string; descripcion: string; filas: Fila[] }) {
  const maxPct = filas.length > 0 ? filas[0].pct : 0;
  return (
    <section className="rounded-2xl border border-border bg-gradient-to-b from-card to-background p-6 shadow-lg shadow-foreground/5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{titulo}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground/70">{descripcion}</p>
        </div>
        {filas.length > 0 && (
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${colorSemaforo(maxPct).chip}`}>
            Máx. concentración: {maxPct.toFixed(1)}%
          </span>
        )}
      </div>
      <div className="space-y-3">
        {filas.length === 0 && <p className="text-sm text-muted-foreground">Sin cartera en gestión.</p>}
        {filas.map((fila) => {
          const c = colorSemaforo(fila.pct);
          return (
            <div key={fila.nombre} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-foreground">{fila.nombre}</span>
                <span className="flex shrink-0 items-baseline gap-3 font-mono">
                  <span className="text-muted-foreground">{fmtARS.format(fila.monto)}</span>
                  <span className={`w-14 text-right font-semibold ${c.texto}`}>{fila.pct.toFixed(1)}%</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted/50">
                <div className={`h-full rounded-full ${c.barra}`} style={{ width: `${Math.min(100, fila.pct)}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground/70">{fila.cheques} {fila.cheques === 1 ? "cheque" : "cheques"} en gestión</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default async function RiesgoCarteraPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal1") redirect("/mfa-setup");
  if (aal?.currentLevel !== "aal2") redirect("/mfa-verify");

  const [{ data: porCliente }, { data: porBanco }, { data: resumen }] = await Promise.all([
    supabase.from("vw_exposicion_cliente").select("*"),
    supabase.from("vw_exposicion_banco").select("*"),
    supabase.from("vw_concentracion_resumen").select("*").single(),
  ]);

  const carteraTotal = Number(resumen?.cartera_total ?? 0);

  const filasCliente: Fila[] = (porCliente ?? []).map((r) => ({
    nombre: r.razon_social, cheques: Number(r.cheques), monto: Number(r.monto), pct: Number(r.pct),
  }));
  const filasBanco: Fila[] = (porBanco ?? []).map((r) => ({
    nombre: r.banco, cheques: Number(r.cheques), monto: Number(r.monto), pct: Number(r.pct),
  }));

  return (
    <main className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="border-b border-border pb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Riesgo · Cartera</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Concentración de tu cartera en gestión (cheques en custodia, aceptados y depositados que todavía no se cobraron).
            Cartera total en la calle: <span className="font-mono font-semibold text-foreground">{fmtARS.format(carteraTotal)}</span>.
          </p>
        </header>

        <Seccion
          titulo="Exposición por cliente"
          descripcion="Cuánto de tu cartera depende de cada cliente. Alta concentración = más riesgo si uno falla."
          filas={filasCliente}
        />
        <Seccion
          titulo="Exposición por banco emisor"
          descripcion="Cuánto de tu cartera está librada contra cada banco."
          filas={filasBanco}
        />

        <p className="text-[11px] text-muted-foreground/70">
          Semáforo: <span className="text-primary">verde</span> hasta 30% · <span className="text-warning">ámbar</span> 30–50% · <span className="text-danger">rojo</span> más de 50%.
          Los umbrales son orientativos; ajustalos a tu criterio de negocio.
        </p>
      </div>
    </main>
  );
}
