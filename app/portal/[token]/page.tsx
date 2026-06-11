import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import SolicitarLiquidacion from "@/components/portal/solicitar-liquidacion";

export const metadata = { robots: { index: false, follow: false } };

const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

export default async function PortalClientePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token || token.length < 32) notFound();

  const admin = createAdminClient();
  const { data: cliente } = await admin
    .from("clientes")
    .select("id, razon_social, cuit, fee_porcentaje, fee_interior_porcentaje")
    .eq("portal_token", token)
    .single();
  if (!cliente) notFound();

  const [{ data: saldoRow }, { data: enGestion }, { data: movimientos }, { data: solicitudes }] =
    await Promise.all([
      admin.from("vw_saldos_clientes").select("saldo_disponible").eq("cliente_id", cliente.id).single(),
      admin.from("cheques")
        .select("numero_cheque, librador, monto, estado, fecha_cobro, fecha_estimada_acred")
        .eq("cliente_id", cliente.id)
        .in("estado", ["en_custodia", "aceptado", "depositado"])
        .order("fecha_cobro"),
      admin.from("movimientos_clientes")
        .select("created_at, descripcion, monto")
        .eq("cliente_id", cliente.id)
        .order("created_at", { ascending: false })
        .limit(20),
      admin.from("solicitudes_liquidacion")
        .select("id, created_at, monto, beneficiario, cvu_cbu_destino, alias_destino, estado, motivo_rechazo, comprobante_drive_id")
        .eq("cliente_id", cliente.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  const saldo = Number(saldoRow?.saldo_disponible ?? 0);
  const gestion = enGestion ?? [];
  const sols = solicitudes ?? [];
  const montoGestion = gestion.reduce((a, c) => a + Number(c.monto), 0);
  const pendientes = sols.filter((s) => s.estado === "pendiente");
  const realizadas = sols.filter((s) => s.estado === "procesada");
  const rechazadas = sols.filter((s) => s.estado === "rechazada");
  const disponible = Math.max(0, saldo - pendientes.reduce((a, s) => a + Number(s.monto), 0));
  const depositados = gestion.filter((c) => c.estado === "depositado");
  const otros = gestion.filter((c) => c.estado !== "depositado");

  return (
    <main className="min-h-screen bg-zinc-950 p-4 text-zinc-100 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="flex items-center gap-3 border-b border-zinc-800 pb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 font-mono text-sm font-bold text-zinc-950">GC</div>
          <div>
            <p className="text-sm font-semibold">{cliente.razon_social}</p>
            <p className="text-xs text-zinc-500">CUIT {cliente.cuit} · Portal de cuenta · {new Date().toLocaleString("es-AR")}</p>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 p-4">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Saldo disponible</p>
            <p className="mt-1 font-mono text-xl font-semibold text-emerald-300">{fmt.format(saldo)}</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 p-4">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">En gestión · {gestion.length}</p>
            <p className="mt-1 font-mono text-xl font-semibold text-blue-300">{fmt.format(montoGestion)}</p>
          </div>
          <div className="col-span-2 rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 p-4 sm:col-span-1">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Tu comisión</p>
            <p className="mt-1 font-mono text-sm text-zinc-300">Cámara {Number(cliente.fee_porcentaje).toFixed(2)}%{cliente.fee_interior_porcentaje != null ? ` · Interior ${Number(cliente.fee_interior_porcentaje).toFixed(2)}%` : ""}</p>
          </div>
        </div>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Solicitar transferencia</p>
            <p className="text-[11px] text-zinc-500">Disponible: <span className="font-mono text-emerald-300">{fmt.format(disponible)}</span></p>
          </div>
          <div className="p-4"><SolicitarLiquidacion token={token} disponible={disponible} /></div>
        </section>

        {pendientes.length > 0 && (
          <section className="rounded-2xl border border-amber-800/40 bg-zinc-900/50">
            <p className="border-b border-amber-900/30 px-4 py-3 text-xs font-medium uppercase tracking-wide text-amber-300">En proceso · {pendientes.length}</p>
            <div className="divide-y divide-zinc-800/70">
              {pendientes.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-zinc-100"><span className="font-mono">{fmt.format(Number(s.monto))}</span> → {s.beneficiario}</p>
                    <p className="truncate text-xs text-zinc-500">{s.cvu_cbu_destino ?? s.alias_destino} · {new Date(s.created_at).toLocaleDateString("es-AR")}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-300">Pendiente</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {realizadas.length > 0 && (
          <section className="rounded-2xl border border-emerald-800/40 bg-zinc-900/50">
            <p className="border-b border-emerald-900/30 px-4 py-3 text-xs font-medium uppercase tracking-wide text-emerald-300">Transferencias realizadas · {realizadas.length}</p>
            <div className="divide-y divide-zinc-800/70">
              {realizadas.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-zinc-100"><span className="font-mono">{fmt.format(Number(s.monto))}</span> → {s.beneficiario}</p>
                    <p className="truncate text-xs text-zinc-500">{s.cvu_cbu_destino ?? s.alias_destino} · {new Date(s.created_at).toLocaleDateString("es-AR")}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-300">Realizada</span>
                    {s.comprobante_drive_id && (
                      <a href={`/api/comprobante?token=${token}&solicitud=${s.id}`} className="text-[10px] font-medium text-emerald-400 underline underline-offset-2">⬇ Descargar comprobante</a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {rechazadas.length > 0 && (
          <section className="rounded-2xl border border-red-900/40 bg-zinc-900/50">
            <p className="border-b border-red-900/30 px-4 py-3 text-xs font-medium uppercase tracking-wide text-red-300">Solicitudes rechazadas · {rechazadas.length}</p>
            <div className="divide-y divide-zinc-800/70">
              {rechazadas.map((s) => (
                <div key={s.id} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-zinc-100"><span className="font-mono">{fmt.format(Number(s.monto))}</span> → {s.beneficiario}</p>
                    <span className="shrink-0 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-300">Rechazada</span>
                  </div>
                  <p className="mt-1 text-xs text-red-300/80">Motivo: {s.motivo_rechazo ?? "no especificado"}. El monto volvió a tu disponible.</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {depositados.length > 0 && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50">
            <p className="border-b border-zinc-800 px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-400">Próximas acreditaciones</p>
            <div className="divide-y divide-zinc-800/70">
              {depositados.map((c, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-zinc-100"><span className="font-mono text-zinc-400">N° {c.numero_cheque}</span> · {c.librador}</p>
                    <p className="text-xs text-zinc-500">Acreditación estimada: {c.fecha_estimada_acred ?? "a confirmar"}</p>
                  </div>
                  <span className="shrink-0 font-mono text-zinc-100">{fmt.format(Number(c.monto))}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {otros.length > 0 && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50">
            <p className="border-b border-zinc-800 px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-400">Otros valores en cartera</p>
            <div className="divide-y divide-zinc-800/70">
              {otros.map((c, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-zinc-100"><span className="font-mono text-zinc-400">N° {c.numero_cheque}</span> · {c.librador}</p>
                    <p className="text-xs text-zinc-500">{c.estado === "en_custodia" ? `Diferido — disponible el ${c.fecha_cobro}` : "Próximo a depositar"}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-mono text-zinc-100">{fmt.format(Number(c.monto))}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${c.estado === "en_custodia" ? "bg-amber-500/10 text-amber-300" : "bg-zinc-800 text-zinc-300"}`}>{c.estado === "en_custodia" ? "Custodia" : "Recibido"}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50">
          <p className="border-b border-zinc-800 px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-400">Últimos movimientos</p>
          <div className="divide-y divide-zinc-800/70">
            {(movimientos ?? []).map((m, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-zinc-300">{m.descripcion}</p>
                  <p className="text-xs text-zinc-600">{new Date(m.created_at).toLocaleDateString("es-AR")}</p>
                </div>
                <span className={`shrink-0 font-mono ${Number(m.monto) >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt.format(Number(m.monto))}</span>
              </div>
            ))}
            {(movimientos ?? []).length === 0 && <p className="px-4 py-6 text-center text-sm text-zinc-500">Sin movimientos.</p>}
          </div>
        </section>

        <p className="pb-4 text-center text-[11px] text-zinc-600">Información al momento de la consulta. Las fechas de acreditación son estimadas en días hábiles bancarios. Ante cualquier consulta, escribinos a cobranzas@goat.ar</p>
      </div>
    </main>
  );
}
