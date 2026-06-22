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
import AjusteSaldo from "@/components/admin/ajuste-saldo";
import AnularMovimiento from "@/components/admin/anular-movimiento";

const colorMov: Record<string, string> = {
  acreditacion: "bg-success-muted text-primary",
  debito_rechazo: "bg-danger-muted text-danger",
  liquidacion: "bg-info-muted text-info",
  ajuste_manual: "bg-muted text-foreground/90",
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
    { data: historial },
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
    supabase.rpc("fn_historial_cliente", { p_cliente_id: id }),
  ]);

  if (!cliente) notFound();

  const esAdmin = perfil?.rol === "administrador";
  const fmtARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
  const saldo = Number(saldoRow?.saldo_disponible ?? 0);
  const gananciaTotal = (ganancias ?? []).reduce(
    (acc, g) => acc + Number(g.ganancia_total ?? 0), 0);

  const cards = [
    { titulo: "Saldo disponible", valor: fmtARS.format(saldo), color: "text-primary" },
    { titulo: "Ganancia neta generada", valor: fmtARS.format(gananciaTotal), color: "text-info" },
    { titulo: `Total gestionado (${kpi?.total_cheques ?? 0} cheques)`, valor: fmtARS.format(Number(kpi?.monto_total ?? 0)), color: "text-foreground" },
    { titulo: "% de rechazo", valor: `${Number(kpi?.pct_rechazo ?? 0).toFixed(1)}%`, color: Number(kpi?.pct_rechazo ?? 0) > 0 ? "text-warning" : "text-primary" },
  ];

  return (
    <main className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{cliente.razon_social}</h1>
            <p className="font-mono text-sm text-muted-foreground">
              {cliente.cuit} · {cliente.email} · Fee Cámara {Number(cliente.fee_porcentaje).toFixed(2)}%{cliente.fee_interior_porcentaje != null && ` · Interior ${Number(cliente.fee_interior_porcentaje).toFixed(2)}%`}
            </p>
            <Link href="/clientes" className="text-sm text-muted-foreground hover:text-foreground">
              ← Volver a clientes
            </Link>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <a
              href={`/resumen-cliente?id=${cliente.id}`}
              target="_blank"
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/90 transition hover:bg-muted"
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

        {esAdmin && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/40 px-4 py-3">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Exportar extracto de cuenta</span>
            <ExportarXls endpoint={`/api/export/movimientos?cliente=${cliente.id}`} />
            <div className="ml-auto"><AjusteSaldo clienteId={cliente.id} /></div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <div key={c.titulo} className="rounded-2xl border border-border bg-gradient-to-b from-card to-background p-5 shadow-lg shadow-foreground/5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.titulo}</p>
              <p className={`metric metric-lg mt-2 ${c.color}`}>{c.valor}</p>
            </div>
          ))}
        </div>

        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Movimientos de cuenta
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-border shadow-lg shadow-foreground/5">
            <table className="w-full text-sm">
              <thead className="bg-card/80 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Descripción</th>
                  <th className="px-4 py-3 text-right font-medium">Monto</th>
                  {esAdmin && <th className="px-4 py-3 text-right font-medium">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {(movimientos ?? []).map((m) => (
                  <tr key={m.id} className="transition hover:bg-muted/40">
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {new Date(m.created_at).toLocaleString("es-AR")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full whitespace-nowrap px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${colorMov[m.tipo] ?? ""}`}>
                        {m.tipo.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground/90">{m.descripcion}</td>
                    <td className={`px-4 py-3 text-right font-mono ${Number(m.monto) >= 0 ? "text-primary" : "text-danger"}`}>
                      {fmtARS.format(Number(m.monto))}
                    </td>
                    {esAdmin && (
                      <td className="px-4 py-3 text-right">
                        {m.tipo === "ajuste_manual" && <AnularMovimiento movimientoId={m.id} />}
                      </td>
                    )}
                  </tr>
                ))}
                {(movimientos ?? []).length === 0 && (
                  <tr>
                    <td colSpan={esAdmin ? 5 : 4} className="px-4 py-8 text-center text-muted-foreground">
                      Sin movimientos todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Cheques del cliente
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-border shadow-lg shadow-foreground/5">
            <table className="w-full text-sm">
              <thead className="bg-card/80 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">N°</th>
                  <th className="px-4 py-3 font-medium">Librador</th>
                  <th className="px-4 py-3 text-right font-medium">Monto</th>
                  <th className="px-4 py-3 text-right font-medium">Fee</th>
                  <th className="px-4 py-3 font-medium">Cobro</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {(cheques ?? []).map((ch) => (
                  <tr key={ch.id} className="transition hover:bg-muted/40">
                    <td className="px-4 py-3 font-mono text-foreground/90">{ch.numero_cheque}</td>
                    <td className="px-4 py-3 text-foreground">{ch.librador}</td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">{fmtARS.format(Number(ch.monto))}</td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">{fmtARS.format(Number(ch.fee_calculado))}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{ch.fecha_cobro}</td>
                    <td className="px-4 py-3 text-foreground/90 uppercase text-xs">{ch.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {esAdmin && (
          <section>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Historial de cambios
            </h2>
            <div className="space-y-0 rounded-2xl border border-border bg-gradient-to-b from-card to-background p-5 shadow-lg shadow-foreground/5">
              {(historial ?? []).map((h: { created_at: string; usuario_email: string | null; accion: string; tabla: string; descripcion: string }, i: number) => (
                <div key={i} className="flex gap-4 border-l-2 border-border py-2 pl-4 text-sm">
                  <span className="w-44 shrink-0 font-mono text-xs text-muted-foreground">
                    {new Date(h.created_at).toLocaleString("es-AR")}
                  </span>
                  <span className="text-foreground">
                    {h.descripcion}
                    <span className="text-muted-foreground"> — {h.usuario_email ?? "sistema"}</span>
                  </span>
                </div>
              ))}
              {(historial ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sin cambios registrados.</p>}
            </div>
          </section>
        )}

        {esAdmin && (
          <EliminarCliente clienteId={cliente.id} nombre={cliente.razon_social} />
        )}
      </div>
    </main>
  );
}
