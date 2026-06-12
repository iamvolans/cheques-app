import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import Liquidar from "@/components/clientes/liquidar";
import { FileText } from "lucide-react";
import EliminarCliente from "@/components/admin/eliminar-cliente";
import PortalCliente from "@/components/clientes/portal-cliente";
import ReaplicarTarifa from "@/components/admin/reaplicar-tarifa";
import ExportarXls from "@/components/ui/exportar-xls";
import EditarCliente from "@/components/clientes/editar-cliente";

const colorMov: Record<string, string> = {
  acreditacion: "bg-emerald-950 text-emerald-300",
  debito_rechazo: "bg-red-950 text-red-300",
  liquidacion: "bg-blue-950 text-blue-300",
  ajuste_manual: "bg-zinc-800 text-zinc-300",
};

export default async function PerfilClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal1") redirect("/mfa-setup");
  if (aal?.currentLevel !== "aal2") redirect("/mfa-verify");

  const [
    { data: perfil },
    { data: cliente },
    { data: saldoRow },
    { data: ganancias },
    { data: kpi },
    { data: movimientos },
    { data: cheques },
  ] = await Promise.all([
    supabase.from("perfiles").select("rol").eq("id", user.id).single(),
    supabase.from("clientes").select("*").eq("id", id).single(),
    supabase.from("vw_saldos_clientes").select("saldo_disponible").eq("cliente_id", id).single(),
    supabase.from("vw_ganancias").select("*").eq("cliente_id", id),
    supabase.from("vw_kpi_clientes").select("*").eq("cliente_id", id).single(),
    supabase
      .from("movimientos_clientes")
      .select("*")
      .eq("cliente_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("cheques")
      .select("id, numero_cheque, librador, monto, fee_calculado, estado, fecha_cobro")
      .eq("cliente_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (!cliente) notFound();

  const esAdmin = perfil?.rol === "administrador";
  const fmtARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
  const saldo = Number(saldoRow?.saldo_disponible ?? 0);
  const gananciaTotal = (ganancias ?? []).reduce(
    (acc, g) => acc + Number(g.ganancia_total ?? 0), 0);

  const cards = [
    { titulo: "Saldo disponible", valor: fmtARS.format(saldo), color: "text-emerald-400" },
    { titulo: "Ganancia neta generada", valor: fmtARS.format(gananciaTotal), color: "text-blue-400" },
    { titulo: `Total gestionado (${kpi?.total_cheques ?? 0} cheques)`, valor: fmtARS.format(Number(kpi?.monto_total ?? 0)), color: "text-zinc-100" },
    { titulo: "% de rechazo", valor: `${Number(kpi?.pct_rechazo ?? 0).toFixed(1)}%`, color: Number(kpi?.pct_rechazo ?? 0) > 0 ? "text-amber-400" : "text-emerald-400" },
  ];

  return (
    <main className="min-h-screen bg-zinc-950 p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">{cliente.razon_social}</h1>
            <p className="font-mono text-sm text-zinc-400">
              {cliente.cuit} · {cliente.email} · Fee Cámara {Number(cliente.fee_porcentaje).toFixed(2)}%{cliente.fee_interior_porcentaje != null && ` · Interior ${Number(cliente.fee_interior_porcentaje).toFixed(2)}%`}
            </p>
            <Link href="/clientes" className="text-sm text-zinc-400 hover:text-zinc-200">
              ← Volver a clientes
            </Link>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <a
              href={`/resumen-cliente?id=${cliente.id}`}
              target="_blank"
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800"
            >
              <FileText size={13} className="-mt-0.5 mr-1.5 inline" />Resumen de cuenta
            </a>
            {esAdmin && (
              <PortalCliente clienteId={cliente.id} token={cliente.portal_token ?? null} />
            )}
            {esAdmin && (
              <ReaplicarTarifa clienteId={cliente.id} feeCamara={Number(cliente.fee_porcentaje)} feeInterior={cliente.fee_interior_porcentaje != null ? Number(cliente.fee_interior_porcentaje) : null} />
            )}
            {esAdmin && (
              <ExportarXls endpoint={`/api/export/movimientos?cliente=${cliente.id}`} />
            )}
            {esAdmin && (
              <EditarCliente
                clienteId={cliente.id}
                email={cliente.email}
                fee={Number(cliente.fee_porcentaje)}
                feeInterior={cliente.fee_interior_porcentaje != null ? Number(cliente.fee_interior_porcentaje) : null}
              />
            )}
            {esAdmin && <Liquidar clienteId={cliente.id} saldo={saldo} />}
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <div key={c.titulo} className="rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 p-5 shadow-lg shadow-black/20">
              <p className="text-xs uppercase tracking-wide text-zinc-500">{c.titulo}</p>
              <p className={`mt-2 font-mono text-2xl font-semibold ${c.color}`}>{c.valor}</p>
            </div>
          ))}
        </div>

        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-400">
            Movimientos de cuenta
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-zinc-800 shadow-lg shadow-black/20">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/80 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Descripción</th>
                  <th className="px-4 py-3 text-right font-medium">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 bg-zinc-950">
                {(movimientos ?? []).map((m) => (
                  <tr key={m.id} className="transition hover:bg-zinc-800/40">
                    <td className="px-4 py-3 font-mono text-zinc-400">
                      {new Date(m.created_at).toLocaleString("es-AR")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full whitespace-nowrap px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${colorMov[m.tipo] ?? ""}`}>
                        {m.tipo.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{m.descripcion}</td>
                    <td className={`px-4 py-3 text-right font-mono ${Number(m.monto) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {fmtARS.format(Number(m.monto))}
                    </td>
                  </tr>
                ))}
                {(movimientos ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                      Sin movimientos todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-400">
            Cheques del cliente
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-zinc-800 shadow-lg shadow-black/20">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/80 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">N°</th>
                  <th className="px-4 py-3 font-medium">Librador</th>
                  <th className="px-4 py-3 text-right font-medium">Monto</th>
                  <th className="px-4 py-3 text-right font-medium">Fee</th>
                  <th className="px-4 py-3 font-medium">Cobro</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 bg-zinc-950">
                {(cheques ?? []).map((ch) => (
                  <tr key={ch.id} className="transition hover:bg-zinc-800/40">
                    <td className="px-4 py-3 font-mono text-zinc-300">{ch.numero_cheque}</td>
                    <td className="px-4 py-3 text-zinc-100">{ch.librador}</td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-100">{fmtARS.format(Number(ch.monto))}</td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-400">{fmtARS.format(Number(ch.fee_calculado))}</td>
                    <td className="px-4 py-3 font-mono text-zinc-400">{ch.fecha_cobro}</td>
                    <td className="px-4 py-3 text-zinc-300 uppercase text-xs">{ch.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {esAdmin && (
          <EliminarCliente clienteId={cliente.id} nombre={cliente.razon_social} />
        )}
      </div>
    </main>
  );
}
