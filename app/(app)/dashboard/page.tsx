import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  TrendingUp, Wallet, AlertOctagon, CircleDollarSign,
  Inbox, Landmark, Clock4, Siren,
} from "lucide-react";
import Graficos from "@/components/dashboard/graficos";
import AcreditacionesVencidas from "@/components/dashboard/acreditaciones-vencidas";

const colorEstado: Record<string, string> = {
  en_custodia: "bg-amber-500/10 text-amber-300",
  aceptado: "bg-zinc-800 text-zinc-300",
  depositado: "bg-blue-500/10 text-blue-300",
  procesado: "bg-emerald-500/10 text-emerald-300",
  rechazado: "bg-red-500/10 text-red-300",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: ganancias }, { data: saldos }, { data: estados }, { data: recientes }, { data: resueltos }] =
    await Promise.all([
      supabase.from("vw_ganancias").select("*"),
      supabase.from("vw_saldos_clientes").select("saldo_disponible"),
      supabase.from("cheques").select("estado, monto, fecha_cobro, created_at"),
      supabase
        .from("cheques")
        .select("id, numero_cheque, librador, monto, estado, created_at, clientes(razon_social)")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("cheques")
        .select("monto, fee_calculado, multa, gasto_bancario, estado, fecha_resolucion")
        .not("fecha_resolucion", "is", null)
        .gte("fecha_resolucion", new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString()),
    ]);

  const fmtARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
  const hoy = new Date().toISOString().slice(0, 10);

  // ---- Financiero ----
  const gananciaNeta = (ganancias ?? []).reduce((a, g) => a + Number(g.ganancia_total ?? 0), 0);
  const pendiente = (saldos ?? []).reduce((a, s) => a + Math.max(0, Number(s.saldo_disponible ?? 0)), 0);
  const procesados = (estados ?? []).filter((c) => c.estado === "procesado");
  const volumenProcesado = procesados.reduce((a, c) => a + Number(c.monto), 0);
  const rechazados = (estados ?? []).filter((c) => c.estado === "rechazado").length;

  // ---- Operación física ----
  const enOficina = (estados ?? []).filter(
    (c) => c.estado === "aceptado" || (c.estado === "en_custodia" && c.fecha_cobro <= hoy)
  );
  const urgentes = enOficina.filter((c) =>
    c.estado === "aceptado"
      ? String(c.created_at).slice(0, 10) < hoy
      : c.fecha_cobro < hoy
  );
  const depositados = (estados ?? []).filter((c) => c.estado === "depositado");
  const enCustodia = (estados ?? []).filter(
    (c) => c.estado === "en_custodia" && c.fecha_cobro > hoy
  );
  const suma = (arr: { monto: unknown }[]) => arr.reduce((a, c) => a + Number(c.monto), 0);

  // ---- Serie mensual (neta) ----
  const porMes = new Map<string, { mes: string; ganancia: number; volumen: number; rechazos: number; total: number }>();
  for (const c of resueltos ?? []) {
    const mes = String(c.fecha_resolucion).slice(0, 7);
    const g = porMes.get(mes) ?? { mes, ganancia: 0, volumen: 0, rechazos: 0, total: 0 };
    g.total++;
    if (c.estado === "procesado") {
      g.ganancia += Number(c.fee_calculado);
      g.volumen += Number(c.monto);
    }
    if (c.estado === "rechazado") {
      g.ganancia += Number(c.fee_calculado) + Number(c.multa ?? 0) - Number(c.gasto_bancario ?? 0);
      g.rechazos++;
    }
    porMes.set(mes, g);
  }
  const serie = [...porMes.values()]
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .map((g) => ({ ...g, pctRechazo: g.total ? +((100 * g.rechazos) / g.total).toFixed(1) : 0 }));

  const tonos: Record<string, { chip: string; valor: string; halo: string }> = {
    emerald: { chip: "bg-emerald-500/10 text-emerald-400", valor: "text-emerald-300", halo: "hover:border-emerald-700/60 hover:shadow-emerald-900/20" },
    blue: { chip: "bg-blue-500/10 text-blue-400", valor: "text-blue-300", halo: "hover:border-blue-700/60 hover:shadow-blue-900/20" },
    violet: { chip: "bg-violet-500/10 text-violet-400", valor: "text-violet-300", halo: "hover:border-violet-700/60 hover:shadow-violet-900/20" },
    amber: { chip: "bg-amber-500/10 text-amber-400", valor: "text-amber-300", halo: "hover:border-amber-700/60 hover:shadow-amber-900/20" },
    red: { chip: "bg-red-500/10 text-red-400", valor: "text-red-300", halo: "hover:border-red-700/60 hover:shadow-red-900/20" },
    zinc: { chip: "bg-zinc-500/10 text-zinc-300", valor: "text-zinc-100", halo: "hover:border-zinc-600" },
  };

  const financiero = [
    { titulo: "Ganancia neta", valor: fmtARS.format(gananciaNeta), Icon: TrendingUp, tono: "emerald" },
    { titulo: `Volumen procesado · ${procesados.length} ok`, valor: fmtARS.format(volumenProcesado), Icon: CircleDollarSign, tono: "violet" },
    { titulo: "Pendiente a liquidar", valor: fmtARS.format(pendiente), Icon: Wallet, tono: "blue" },
    { titulo: "Rechazos / gestionados", valor: `${rechazados} / ${(estados ?? []).length}`, Icon: AlertOctagon, tono: rechazados > 0 ? "red" : "zinc" },
  ];

  const fisico = [
    { titulo: `En oficina · ${enOficina.length} cheques`, sub: "listos para llevar al banco", valor: fmtARS.format(suma(enOficina)), Icon: Inbox, tono: enOficina.length > 0 ? "amber" : "zinc" },
    { titulo: `Depositados · ${depositados.length} cheques`, sub: "en el banco, esperando acreditación", valor: fmtARS.format(suma(depositados)), Icon: Landmark, tono: "blue" },
    { titulo: `En custodia · ${enCustodia.length} diferidos`, sub: "aún no llegó su fecha de cobro", valor: fmtARS.format(suma(enCustodia)), Icon: Clock4, tono: "zinc" },
  ];

  const Tarjeta = ({ titulo, sub, valor, Icon, tono }: { titulo: string; sub?: string; valor: string; Icon: typeof Inbox; tono: string }) => (
    <div className={`rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 p-5 shadow-lg shadow-black/20 transition ${tonos[tono].halo}`}>
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${tonos[tono].chip}`}>
        <Icon size={19} />
      </div>
      <p className="text-xs uppercase tracking-wide text-zinc-500">{titulo}</p>
      {sub && <p className="text-[11px] text-zinc-600">{sub}</p>}
      <p className={`mt-1 font-mono text-2xl font-semibold tracking-tight ${tonos[tono].valor}`}>{valor}</p>
    </div>
  );

  return (
    <main className="p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Dashboard</h1>
          <p className="text-sm text-zinc-500">El pulso de la operación en tiempo real.</p>
        </div>

        <AcreditacionesVencidas />

        {enOficina.length > 0 && (
          <Link
            href="/cheques"
            className={`flex items-center gap-4 rounded-2xl border p-4 shadow-lg transition hover:brightness-110 ${
              urgentes.length > 0
                ? "border-red-800 bg-red-950/60 shadow-red-950/30"
                : "border-amber-800 bg-amber-950/50 shadow-amber-950/30"
            }`}
          >
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${urgentes.length > 0 ? "bg-red-500/15 text-red-300" : "bg-amber-500/15 text-amber-300"}`}>
              <Siren size={22} />
            </span>
            <span className="min-w-0">
              <span className={`block font-semibold ${urgentes.length > 0 ? "text-red-200" : "text-amber-200"}`}>
                {enOficina.length} cheque{enOficina.length === 1 ? "" : "s"} en oficina por {fmtARS.format(suma(enOficina))} — hay que llevarlos al banco
              </span>
              <span className="block text-sm text-zinc-400">
                {urgentes.length > 0
                  ? `${urgentes.length} esperan desde ayer o antes (incluye diferidos ya vencidos). Tocá para verlos.`
                  : "Cargados hoy o diferidos que ya vencieron. Tocá para ver el detalle."}
              </span>
            </span>
          </Link>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {financiero.map((c) => <Tarjeta key={c.titulo} {...c} />)}
        </div>

        <div>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-400">Operación física</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {fisico.map((c) => <Tarjeta key={c.titulo} {...c} />)}
          </div>
        </div>

        <Graficos datos={serie} />

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 shadow-lg shadow-black/20">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
            <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-400">
              Actividad reciente
            </h2>
            <Link href="/cheques" className="text-xs text-emerald-400 hover:underline">
              Ver todos →
            </Link>
          </div>
          <div className="divide-y divide-zinc-800/70">
            {(recientes ?? []).map((ch) => (
              <Link
                key={ch.id}
                href={`/cheques/${ch.id}`}
                className="flex items-center justify-between gap-4 px-5 py-3 text-sm transition hover:bg-zinc-800/30"
              >
                <div className="min-w-0">
                  <p className="truncate text-zinc-100">
                    <span className="font-mono text-zinc-400">N° {ch.numero_cheque}</span> · {ch.librador}
                  </p>
                  <p className="text-xs text-zinc-500">{(ch.clientes as unknown as { razon_social?: string } | null)?.razon_social}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-zinc-100">{fmtARS.format(Number(ch.monto))}</span>
                  <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium uppercase ${colorEstado[ch.estado] ?? ""}`}>
                    {ch.estado === "en_custodia" ? "custodia" : ch.estado}
                  </span>
                </div>
              </Link>
            ))}
            {(recientes ?? []).length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-zinc-500">Sin actividad todavía.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
