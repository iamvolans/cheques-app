import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import SolicitarLiquidacion from "@/components/portal/solicitar-liquidacion";

export const metadata = { robots: { index: false, follow: false } };

const colorEstado: Record<string, { etiqueta: string; clase: string }> = {
  en_custodia: { etiqueta: "En custodia", clase: "bg-amber-500/10 text-amber-300" },
  aceptado: { etiqueta: "Recibido", clase: "bg-zinc-800 text-zinc-300" },
  depositado: { etiqueta: "Depositado", clase: "bg-blue-500/10 text-blue-300" },
};

const pillSol: Record<string, string> = {
  pendiente: "bg-amber-500/10 text-amber-300",
  procesada: "bg-emerald-500/10 text-emerald-300",
  rechazada: "bg-red-500/10 text-red-300",
};

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
    .select("id, razon_social, cuit")
    .eq("portal_token", token)
    .single();
  if (!cliente) notFound();

  const [{ data: saldoRow }, { data: enGestion }, { data: movimientos }, { data: solicitudes }] =
    await Promise.all([
      admin.from("vw_saldos_clientes").select("saldo_disponible").eq("cliente_id", cliente.id).single(),
      admin
        .from("cheques")
        .select("numero_cheque, librador, monto, estado, fecha_cobro, fecha_estimada_acred")
        .eq("cliente_id", cliente.id)
        .in("estado", ["en_custodia", "aceptado", "depositado"])
        .order("fecha_cobro"),
      admin
        .from("movimientos_clientes")
        .select("created_at, tipo, descripcion, monto")
        .eq("cliente_id", cliente.id)
        .order("created_at", { ascending: false })
        .limit(20),
      admin
        .from("solicitudes_liquidacion")
        .select("id, created_at, monto, beneficiario, cvu_cbu_destino, alias_destino, estado, motivo_rechazo, comprobante_drive_id")
        .eq("cliente_id", cliente.id)
        .order("created_at", { ascending: false })
        .limit(15),
    ]);

  const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
  const saldo = Number(saldoRow?.saldo_disponible ?? 0);
  const montoGestion = (enGestion ?? []).reduce((a, c) => a + Number(c.monto), 0);
  const pendienteSolicitado = (solicitudes ?? [])
    .filter((s) => s.estado === "pendiente")
    .reduce((a, s) => a + Number(s.monto), 0);
  const disponible = Math.max(0, saldo - pendienteSolicitado);
  const realizadas = (solicitudes ?? []).filter((s) => s.estado === "procesada");

  return (
    <main className="min-h-screen bg-zinc-950 p-4 text-zinc-100 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex items-center gap-3 border-b border-zinc-800 pb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 font-mono text-sm font-bold text-zinc-950">
            GC
          </div>
          <div>
            <p className="text-sm font-semibold">{cliente.razon_social}</p>
            <p className="text-xs text-zinc-500">
              CUIT {cliente.cuit} · Portal de cuenta · {new Date().toLocaleString("es-AR")}
            </p>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 p-4">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Saldo disponible</p>
            <p className="mt-1 font-mono text-xl font-semibold text-emerald-300">{fmt.format(saldo)}</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 p-4">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">
              En gestión · {(enGestion ?? []).length} valores
            </p>
            <p className="mt-1 font-mono text-xl font-semibold text-blue-300">{fmt.format(montoGestion)}</p>
          </div>
        </div>

        {realizadas.length > 0 && (
          <div className="rounded-2xl border border-emerald-800/60 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
            ✅ Tenés {realizadas.length} transferencia{realizadas.length === 1 ? "" : "s"} realizada{realizadas.length === 1 ? "" : "s"}. El comprobante está disponible para descargar abajo.
          </div>
        )}

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Retiros / Transferencias
            </p>
            <p className="text-[11px] text-zinc-500">
              Disponible para solicitar:{" "}
              <span className="font-mono text-emerald-300">{fmt.format(disponible)}</span>
            </p>
          </div>
          <div className="space-y-3 p-4">
            <SolicitarLiquidacion token={token} disponible={disponible} />
            {(solicitudes ?? []).map((s, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800/70 bg-zinc-950/60 px-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-zinc-100">
                    <span className="font-mono">{fmt.format(Number(s.monto))}</span> → {s.beneficiario}
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    {s.cvu_cbu_destino ?? s.alias_destino} ·{" "}
                    {new Date(s.created_at).toLocaleDateString("es-AR")}
                    {s.estado === "rechazada" && s.motivo_rechazo && ` — ${s.motivo_rechazo}`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`rounded-full whitespace-nowrap px-2 py-0.5 text-[10px] font-semibold uppercase ${pillSol[s.estado] ?? ""}`}>
                    {s.estado}
                  </span>
                  {s.estado === "procesada" && s.comprobante_drive_id && (
                    <a href={`/api/comprobante?token=${token}&solicitud=${s.id}`} className="text-[10px] font-medium text-emerald-400 underline underline-offset-2">⬇ Descargar comprobante</a>
                  )}
                </div>
              </div>
            ))}
            {(solicitudes ?? []).length === 0 && disponible <= 0 && (
              <p className="py-2 text-center text-xs text-zinc-600">
                Sin saldo disponible para retirar por el momento.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50">
          <p className="border-b border-zinc-800 px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-400">
            Valores en proceso
          </p>
          <div className="divide-y divide-zinc-800/70">
            {(enGestion ?? []).map((c, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-zinc-100">
                    <span className="font-mono text-zinc-400">N° {c.numero_cheque}</span> · {c.librador}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {c.estado === "depositado"
                      ? `Acreditación estimada: ${c.fecha_estimada_acred ?? "a confirmar"}`
                      : c.estado === "en_custodia"
                      ? `Diferido — disponible el ${c.fecha_cobro}`
                      : "En oficina, próximo a depositar"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="font-mono text-zinc-100">{fmt.format(Number(c.monto))}</span>
                  <span
                    className={`rounded-full whitespace-nowrap px-2 py-0.5 text-[10px] font-semibold uppercase ${colorEstado[c.estado]?.clase ?? ""}`}
                  >
                    {colorEstado[c.estado]?.etiqueta ?? c.estado}
                  </span>
                </div>
              </div>
            ))}
            {(enGestion ?? []).length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-zinc-500">Sin valores en proceso.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50">
          <p className="border-b border-zinc-800 px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-400">
            Últimos movimientos
          </p>
          <div className="divide-y divide-zinc-800/70">
            {(movimientos ?? []).map((m, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-zinc-300">{m.descripcion}</p>
                  <p className="text-xs text-zinc-600">{new Date(m.created_at).toLocaleDateString("es-AR")}</p>
                </div>
                <span className={`shrink-0 font-mono ${Number(m.monto) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {fmt.format(Number(m.monto))}
                </span>
              </div>
            ))}
            {(movimientos ?? []).length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-zinc-500">Sin movimientos.</p>
            )}
          </div>
        </section>

        <p className="pb-4 text-center text-[11px] text-zinc-600">
          Información al momento de la consulta. Las fechas de acreditación son estimadas en días
          hábiles bancarios. Ante cualquier consulta, escribinos a cobranzas@goat.ar
        </p>
      </div>
    </main>
  );
}
