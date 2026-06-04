import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { obtenerReporte } from "@/lib/reportes";
import { Download, Printer } from "lucide-react";

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; convenio?: string }>;
}) {
  const f = await searchParams;
  const mes = f.mes ?? new Date().toISOString().slice(0, 7);
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
    obtenerReporte(supabase, mes, f.convenio || undefined),
    supabase.from("convenios").select("id, razon_social").order("razon_social"),
  ]);

  const fmtARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
  const qs = `mes=${mes}${f.convenio ? `&convenio=${f.convenio}` : ""}`;
  const tot = grupos.reduce(
    (a, g) => ({ neto: a.neto + g.neto, iva: a.iva + g.iva, total: a.total + g.total }),
    { neto: 0, iva: 0, total: 0 }
  );

  const inputCls =
    "rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm normal-case tracking-normal text-zinc-100 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15";
  const th = "px-4 py-3 font-medium";
  const tdNum = "px-4 py-3 text-right font-mono";

  return (
    <main className="min-h-screen bg-zinc-950 p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="border-b border-zinc-800 pb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Reportes de facturación</h1>
          <p className="text-sm text-zinc-500">
            Fees devengados por convenio (cheques procesados y rechazados del período) con IVA 21%.
          </p>
        </header>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-zinc-500">
              Mes
              <input name="mes" type="month" defaultValue={mes} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-zinc-500">
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
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-emerald-950/50 transition hover:bg-emerald-500"
            >
              Generar
            </button>
          </form>

          <div className="flex gap-2">
            <a
              href={`/api/reportes?${qs}`}
              className="flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-800"
            >
              <Download size={15} /> CSV (Excel)
            </a>
            <a
              href={`/reporte-impreso?${qs}`}
              target="_blank"
              className="flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-800"
            >
              <Printer size={15} /> Imprimible / PDF
            </a>
          </div>
        </div>

        <section className="overflow-x-auto rounded-2xl border border-zinc-800 shadow-lg shadow-black/20">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/80 text-left text-[11px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className={th}>Convenio</th>
                <th className={`${th} text-right`}>Cheques</th>
                <th className={`${th} text-right`}>Monto gestionado</th>
                <th className={`${th} text-right`}>Fee neto</th>
                <th className={`${th} text-right`}>IVA 21%</th>
                <th className={`${th} text-right`}>Total a facturar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 bg-zinc-950">
              {grupos.map((g) => (
                <tr key={g.convenio} className="transition hover:bg-zinc-800/40">
                  <td className="px-4 py-3 text-zinc-100">{g.convenio}</td>
                  <td className={`${tdNum} text-zinc-400`}>{g.cantidad}</td>
                  <td className={`${tdNum} text-zinc-300`}>{fmtARS.format(g.montoGestionado)}</td>
                  <td className={`${tdNum} text-zinc-100`}>{fmtARS.format(g.neto)}</td>
                  <td className={`${tdNum} text-zinc-400`}>{fmtARS.format(g.iva)}</td>
                  <td className={`${tdNum} font-semibold text-emerald-300`}>{fmtARS.format(g.total)}</td>
                </tr>
              ))}
              {grupos.length > 0 && (
                <tr className="bg-zinc-900/60 font-semibold">
                  <td className="px-4 py-3 text-zinc-100">TOTAL</td>
                  <td className={`${tdNum} text-zinc-400`}>{filas.length}</td>
                  <td className={tdNum}></td>
                  <td className={`${tdNum} text-zinc-100`}>{fmtARS.format(tot.neto)}</td>
                  <td className={`${tdNum} text-zinc-300`}>{fmtARS.format(tot.iva)}</td>
                  <td className={`${tdNum} text-emerald-300`}>{fmtARS.format(tot.total)}</td>
                </tr>
              )}
              {grupos.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-zinc-500">Sin cheques resueltos en ese período.</td></tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="overflow-x-auto rounded-2xl border border-zinc-800 shadow-lg shadow-black/20">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/80 text-left text-[11px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className={th}>Fecha</th>
                <th className={th}>Convenio</th>
                <th className={th}>Cliente</th>
                <th className={th}>N°</th>
                <th className={th}>Librador</th>
                <th className={`${th} text-right`}>Monto</th>
                <th className={`${th} text-right`}>Fee</th>
                <th className={th}>Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 bg-zinc-950">
              {filas.map((fi, i) => (
                <tr key={i} className="transition hover:bg-zinc-800/40">
                  <td className="px-4 py-3 font-mono text-zinc-400">{fi.fecha}</td>
                  <td className="px-4 py-3 text-zinc-300">{fi.convenio}</td>
                  <td className="px-4 py-3 text-zinc-300">{fi.cliente}</td>
                  <td className="px-4 py-3 font-mono text-zinc-300">{fi.numero_cheque}</td>
                  <td className="px-4 py-3 text-zinc-100">{fi.librador}</td>
                  <td className={`${tdNum} text-zinc-100`}>{fmtARS.format(fi.monto)}</td>
                  <td className={`${tdNum} text-zinc-300`}>{fmtARS.format(fi.fee)}</td>
                  <td className="px-4 py-3 text-xs uppercase text-zinc-400">{fi.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
