import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import BotonImprimir from "@/components/reportes/boton-imprimir";

export default async function ResumenClientePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  if (!id) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: cliente },
    { data: saldoRow },
    { data: enProceso },
    { data: movimientos },
    { data: liquidaciones },
  ] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", id).single(),
    supabase.from("vw_saldos_clientes").select("saldo_disponible").eq("cliente_id", id).single(),
    supabase
      .from("cheques")
      .select("numero_cheque, librador, monto, estado, fecha_cobro, fecha_estimada_acred")
      .eq("cliente_id", id)
      .in("estado", ["aceptado", "depositado"])
      .order("fecha_cobro"),
    supabase
      .from("movimientos_clientes")
      .select("*")
      .eq("cliente_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("liquidaciones")
      .select("*")
      .eq("cliente_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (!cliente) notFound();

  const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
  const saldo = Number(saldoRow?.saldo_disponible ?? 0);
  const montoEnProceso = (enProceso ?? []).reduce((a, c) => a + Number(c.monto), 0);

  const th = "border border-zinc-300 bg-zinc-100 px-2 py-1 text-left text-xs font-semibold";
  const td = "border border-zinc-300 px-2 py-1 text-xs";
  const caja = "rounded border border-zinc-300 p-3";

  return (
    <main className="min-h-screen bg-white p-10 font-sans text-zinc-900">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">Resumen de cuenta</h1>
            <p className="text-sm text-zinc-700">
              <strong>{cliente.razon_social}</strong> · CUIT {cliente.cuit}
            </p>
            <p className="text-xs text-zinc-500">
              Emitido el {new Date().toLocaleString("es-AR")} · Comisión acordada: {Number(cliente.fee_porcentaje).toFixed(2)}%
            </p>
          </div>
          <BotonImprimir />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className={caja}>
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">Saldo disponible</p>
            <p className="font-mono text-lg font-bold">{fmt.format(saldo)}</p>
          </div>
          <div className={caja}>
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">
              En gestión ({(enProceso ?? []).length} cheques)
            </p>
            <p className="font-mono text-lg font-bold">{fmt.format(montoEnProceso)}</p>
          </div>
          <div className={caja}>
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">Estado general</p>
            <p className="text-sm font-semibold">
              {saldo > 0 ? "Saldo a liquidar" : (enProceso ?? []).length > 0 ? "Valores en proceso" : "Al día"}
            </p>
          </div>
        </div>

        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide">Cheques en gestión</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>N°</th>
                <th className={th}>Librador</th>
                <th className={th}>Monto</th>
                <th className={th}>Estado</th>
                <th className={th}>Acreditación estimada</th>
              </tr>
            </thead>
            <tbody>
              {(enProceso ?? []).map((c, i) => (
                <tr key={i}>
                  <td className={td}>{c.numero_cheque}</td>
                  <td className={td}>{c.librador}</td>
                  <td className={`${td} text-right`}>{fmt.format(Number(c.monto))}</td>
                  <td className={td}>{c.estado === "depositado" ? "Depositado" : "Aceptado"}</td>
                  <td className={td}>{c.fecha_estimada_acred ?? "A definir"}</td>
                </tr>
              ))}
              {(enProceso ?? []).length === 0 && (
                <tr><td colSpan={5} className={`${td} text-center text-zinc-500`}>Sin valores en gestión.</td></tr>
              )}
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide">Últimos movimientos</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>Fecha</th>
                <th className={th}>Concepto</th>
                <th className={th}>Importe</th>
              </tr>
            </thead>
            <tbody>
              {(movimientos ?? []).map((m, i) => (
                <tr key={i}>
                  <td className={td}>{new Date(m.created_at).toLocaleDateString("es-AR")}</td>
                  <td className={td}>{m.descripcion}</td>
                  <td className={`${td} text-right font-mono`}>{fmt.format(Number(m.monto))}</td>
                </tr>
              ))}
              {(movimientos ?? []).length === 0 && (
                <tr><td colSpan={3} className={`${td} text-center text-zinc-500`}>Sin movimientos.</td></tr>
              )}
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide">Últimas liquidaciones</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>Fecha</th>
                <th className={th}>Coelsa ID</th>
                <th className={th}>Monto liquidado</th>
              </tr>
            </thead>
            <tbody>
              {(liquidaciones ?? []).map((l, i) => (
                <tr key={i}>
                  <td className={td}>{new Date(l.created_at).toLocaleDateString("es-AR")}</td>
                  <td className={`${td} font-mono`}>{l.coelsa_id ?? "—"}</td>
                  <td className={`${td} text-right font-mono`}>{fmt.format(Number(l.monto))}</td>
                </tr>
              ))}
              {(liquidaciones ?? []).length === 0 && (
                <tr><td colSpan={3} className={`${td} text-center text-zinc-500`}>Sin liquidaciones registradas.</td></tr>
              )}
            </tbody>
          </table>
        </section>

        <p className="text-[10px] text-zinc-400">
          Documento informativo generado por Gestión de Cobranza al momento de su emisión. Las fechas de
          acreditación son estimadas en días hábiles bancarios.
        </p>
      </div>
    </main>
  );
}
