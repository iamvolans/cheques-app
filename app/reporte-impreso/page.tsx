import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { obtenerReporte } from "@/lib/reportes";
import BotonImprimir from "@/components/reportes/boton-imprimir";

export default async function ReporteImpresoPage({
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
  const { data: perfil } = await supabase
    .from("perfiles").select("rol").eq("id", user.id).single();
  if (perfil?.rol !== "administrador") redirect("/dashboard");

  const { filas, grupos } = await obtenerReporte(supabase, mes, f.convenio || undefined);
  const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
  const tot = grupos.reduce(
    (a, g) => ({ neto: a.neto + g.neto, iva: a.iva + g.iva, total: a.total + g.total }),
    { neto: 0, iva: 0, total: 0 }
  );

  const th = "border border-zinc-300 bg-zinc-100 px-2 py-1 text-left text-xs font-semibold";
  const td = "border border-zinc-300 px-2 py-1 text-xs";

  return (
    <main className="min-h-screen bg-white p-10 font-sans text-zinc-900">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">Reporte de facturación por convenio</h1>
            <p className="text-sm text-zinc-600">Período: {mes} · IVA 21% sobre comisiones (fees)</p>
            <p className="text-xs text-zinc-500">Incluye cheques procesados y rechazados resueltos en el período.</p>
          </div>
          <BotonImprimir />
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={th}>Convenio</th>
              <th className={th}>Cheques</th>
              <th className={th}>Monto gestionado</th>
              <th className={th}>Fee neto</th>
              <th className={th}>IVA 21%</th>
              <th className={th}>Total a facturar</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => (
              <tr key={g.convenio}>
                <td className={td}>{g.convenio}</td>
                <td className={`${td} text-right`}>{g.cantidad}</td>
                <td className={`${td} text-right`}>{fmt.format(g.montoGestionado)}</td>
                <td className={`${td} text-right`}>{fmt.format(g.neto)}</td>
                <td className={`${td} text-right`}>{fmt.format(g.iva)}</td>
                <td className={`${td} text-right font-semibold`}>{fmt.format(g.total)}</td>
              </tr>
            ))}
            <tr className="font-bold">
              <td className={td}>TOTAL</td>
              <td className={`${td} text-right`}>{filas.length}</td>
              <td className={td}></td>
              <td className={`${td} text-right`}>{fmt.format(tot.neto)}</td>
              <td className={`${td} text-right`}>{fmt.format(tot.iva)}</td>
              <td className={`${td} text-right`}>{fmt.format(tot.total)}</td>
            </tr>
          </tbody>
        </table>

        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={th}>Fecha</th>
              <th className={th}>Convenio</th>
              <th className={th}>Cliente</th>
              <th className={th}>N° cheque</th>
              <th className={th}>Librador</th>
              <th className={th}>Monto</th>
              <th className={th}>Fee</th>
              <th className={th}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fi, i) => (
              <tr key={i}>
                <td className={td}>{fi.fecha}</td>
                <td className={td}>{fi.convenio}</td>
                <td className={td}>{fi.cliente}</td>
                <td className={td}>{fi.numero_cheque}</td>
                <td className={td}>{fi.librador}</td>
                <td className={`${td} text-right`}>{fmt.format(fi.monto)}</td>
                <td className={`${td} text-right`}>{fmt.format(fi.fee)}</td>
                <td className={td}>{fi.estado}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-[10px] text-zinc-400">
          Generado por Gestión de Cobranza · {new Date().toLocaleString("es-AR")}
        </p>
      </div>
    </main>
  );
}
