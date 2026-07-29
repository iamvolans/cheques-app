import { hoyART } from "@/lib/fechas";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { obtenerReporte, rangoPeriodo } from "@/lib/reportes";
import { Download, Printer } from "lucide-react";

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; desde?: string; hasta?: string; convenio?: string }>;
}) {
  const f = await searchParams;
  const { desde, hasta } = rangoPeriodo(f);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal1") redirect("/mfa-setup");
  if (aal?.currentLevel !== "aal2") redirect("/mfa-verify");
  const { data: miPerfil } = await supabase
    .from("perfiles").select("rol").eq("id", user.id).single();
  if (miPerfil?.rol !== "administrador") redirect("/dashboard");

  const [{ filas, grupos }, { data: convenios }] = await Promise.all([
    obtenerReporte(supabase, desde, hasta, f.convenio || undefined),
    supabase.from("convenios").select("id, razon_social").order("razon_social"),
  ]);

  const fmtARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
  const qsObj = new URLSearchParams({ desde, hasta });
  if (f.convenio) qsObj.set("convenio", f.convenio);
  const qs = qsObj.toString();

  const tot = grupos.reduce(
    (a, g) => ({
      montoGestionado: a.montoGestionado + g.montoGestionado,
      feeBruto: a.feeBruto + g.feeBruto,
      costo: a.costo + g.costo,
      multaBanco: a.multaBanco + g.multaBanco,
      neto: a.neto + g.neto,
      iva: a.iva + g.iva,
      total: a.total + g.total,
    }),
    { montoGestionado: 0, feeBruto: 0, costo: 0, multaBanco: 0, neto: 0, iva: 0, total: 0 }
  );

  // Presets de periodo
  const iso = (dt: Date) => dt.toISOString().slice(0, 10);
  const hoyStr = hoyART();
  const anio = Number(hoyStr.slice(0, 4));
  const mesN = Number(hoyStr.slice(5, 7)) - 1;
  const diaN = Number(hoyStr.slice(8, 10));
  const finMesActual = iso(new Date(Date.UTC(anio, mesN + 1, 0)));
  const presets = [
    { l: "Este mes", d: iso(new Date(Date.UTC(anio, mesN, 1))), h: finMesActual },
    { l: "Mes anterior", d: iso(new Date(Date.UTC(anio, mesN - 1, 1))), h: iso(new Date(Date.UTC(anio, mesN, 0))) },
    { l: "1ra quincena", d: iso(new Date(Date.UTC(anio, mesN, 1))), h: iso(new Date(Date.UTC(anio, mesN, 15))) },
    { l: "2da quincena", d: iso(new Date(Date.UTC(anio, mesN, 16))), h: finMesActual },
    { l: "Últimos 7 días", d: iso(new Date(Date.UTC(anio, mesN, diaN - 6))), h: hoyStr },
  ];
  const hrefPreset = (d: string, h: string) => {
    const p = new URLSearchParams({ desde: d, hasta: h });
    if (f.convenio) p.set("convenio", f.convenio);
    return "/admin/reportes?" + p.toString();
  };

  const inputCls =
    "rounded-lg border border-border bg-background px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
  const th = "px-4 py-3 font-medium";
  const tdNum = "px-4 py-3 text-right font-mono";

  return (
    <main className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="border-b border-border pb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reportes de facturación</h1>
          <p className="text-sm text-muted-foreground">
            Neto a facturar por convenio: fee cobrado menos el costo de procesamiento bancario y, en los rechazados, la multa del banco. La multa al cliente es resarcimiento y no se factura. Acreditados imputados por fecha de acreditación; rechazados por fecha de rechazo. IVA 21%.
            Período actual: <span className="font-mono text-foreground/90">{desde}</span> → <span className="font-mono text-foreground/90">{hasta}</span>
          </p>
        </header>

        <div className="flex flex-wrap gap-2">
          {presets.map((p) => {
            const activo = p.d === desde && p.h === hasta;
            const cls = activo
              ? "rounded-lg border border-emerald-600 bg-success-muted px-3 py-1.5 text-xs font-medium text-primary"
              : "rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground/90 transition hover:border-zinc-500";
            return (
              <Link key={p.l} href={hrefPreset(p.d, p.h)} className={cls}>
                {p.l}
              </Link>
            );
          })}
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              Desde
              <input name="desde" type="date" defaultValue={desde} required className={inputCls} />
            </label>
            <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              Hasta
              <input name="hasta" type="date" defaultValue={hasta} required className={inputCls} />
            </label>
            <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              Convenio
              <select name="convenio" defaultValue={f.convenio ?? ""} className={inputCls}>
                <option value="">Todos</option>
                {(convenios ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.razon_social}</option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-md shadow-emerald-950/50 transition hover:bg-primary"
            >
              Generar
            </button>
          </form>

          <div className="flex gap-2">
            <a
              href={"/api/reportes?" + qs}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-foreground transition hover:bg-muted"
            >
              <Download size={15} /> CSV (Excel)
            </a>
            <a
              href={"/reporte-impreso?" + qs}
              target="_blank"
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-foreground transition hover:bg-muted"
            >
              <Printer size={15} /> Imprimible / PDF
            </a>
          </div>
        </div>

        <section className="overflow-x-auto rounded-2xl border border-border shadow-lg shadow-foreground/5">
          <table className="w-full text-sm">
            <thead className="bg-card/80 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className={th}>Convenio</th>
                <th className={th + " text-right"}>Cheques</th>
                <th className={th + " text-right"}>Monto gestionado</th>
                <th className={th + " text-right"}>Fee bruto</th>
                <th className={th + " text-right"}>Costo proc.</th>
                <th className={th + " text-right"}>Multa banco</th>
                <th className={th + " text-right"}>Neto a facturar</th>
                <th className={th + " text-right"}>IVA 21%</th>
                <th className={th + " text-right"}>Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background">
              {grupos.map((g) => (
                <tr key={g.convenio} className="transition hover:bg-muted/40">
                  <td className="px-4 py-3 text-foreground">{g.convenio}</td>
                  <td className={tdNum + " text-muted-foreground"}>{g.cantidad}</td>
                  <td className={tdNum + " text-foreground/90"}>{fmtARS.format(g.montoGestionado)}</td>
                  <td className={tdNum + " text-foreground/90"}>{fmtARS.format(g.feeBruto)}</td>
                  <td className={tdNum + " text-danger"}>-{fmtARS.format(g.costo)}</td>
                  <td className={tdNum + " text-danger"}>{g.multaBanco > 0 ? "-" + fmtARS.format(g.multaBanco) : "—"}</td>
                  <td className={tdNum + (g.neto < 0 ? " font-semibold text-danger" : " text-foreground")}>{fmtARS.format(g.neto)}</td>
                  <td className={tdNum + " text-muted-foreground"}>{fmtARS.format(g.iva)}</td>
                  <td className={tdNum + " font-semibold text-primary"}>{fmtARS.format(g.total)}</td>
                </tr>
              ))}
              {grupos.length > 0 && (
                <tr className="bg-card/60 font-semibold">
                  <td className="px-4 py-3 text-foreground">TOTAL</td>
                  <td className={tdNum + " text-muted-foreground"}>{filas.length}</td>
                  <td className={tdNum + " text-foreground/90"}>{fmtARS.format(tot.montoGestionado)}</td>
                  <td className={tdNum + " text-foreground/90"}>{fmtARS.format(tot.feeBruto)}</td>
                  <td className={tdNum + " text-danger"}>-{fmtARS.format(tot.costo)}</td>
                  <td className={tdNum + " text-danger"}>-{fmtARS.format(tot.multaBanco)}</td>
                  <td className={tdNum + " text-foreground"}>{fmtARS.format(tot.neto)}</td>
                  <td className={tdNum + " text-foreground/90"}>{fmtARS.format(tot.iva)}</td>
                  <td className={tdNum + " text-primary"}>{fmtARS.format(tot.total)}</td>
                </tr>
              )}
              {grupos.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">Sin cheques resueltos en ese período.</td></tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="overflow-x-auto rounded-2xl border border-border shadow-lg shadow-foreground/5">
          <table className="w-full text-sm">
            <thead className="bg-card/80 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className={th}>Fecha</th>
                <th className={th}>Convenio</th>
                <th className={th}>Cliente</th>
                <th className={th}>N°</th>
                <th className={th}>Librador</th>
                <th className={th + " text-right"}>Monto</th>
                <th className={th + " text-right"}>Fee bruto</th>
                <th className={th + " text-right"}>Costo proc.</th>
                <th className={th + " text-right"}>Multa banco</th>
                <th className={th + " text-right"}>Neto</th>
                <th className={th}>Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background">
              {filas.map((fi, i) => (
                <tr key={i} className="transition hover:bg-muted/40">
                  <td className="px-4 py-3 font-mono text-muted-foreground">{fi.fecha}</td>
                  <td className="px-4 py-3 text-foreground/90">{fi.convenio}</td>
                  <td className="px-4 py-3 text-foreground/90">{fi.cliente}</td>
                  <td className="px-4 py-3 font-mono text-foreground/90">{fi.numero_cheque}</td>
                  <td className="px-4 py-3 text-foreground">{fi.librador}</td>
                  <td className={tdNum + " text-foreground"}>{fmtARS.format(fi.monto)}</td>
                  <td className={tdNum + " text-foreground/90"}>{fmtARS.format(fi.feeBruto)}</td>
                  <td className={tdNum + " text-danger"}>-{fmtARS.format(fi.costo)}</td>
                  <td className={tdNum + " text-danger"}>{fi.multaBanco > 0 ? "-" + fmtARS.format(fi.multaBanco) : "—"}</td>
                  <td className={tdNum + (fi.neto < 0 ? " font-semibold text-danger" : " text-foreground")}>{fmtARS.format(fi.neto)}</td>
                  <td className="px-4 py-3 text-xs uppercase text-muted-foreground">{fi.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
