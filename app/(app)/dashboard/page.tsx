import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { TrendingUp, Wallet, Layers, AlertOctagon } from "lucide-react";

const colorEstado: Record<string, string> = {
  aceptado: "bg-zinc-800 text-zinc-300",
  depositado: "bg-blue-500/10 text-blue-300",
  procesado: "bg-emerald-500/10 text-emerald-300",
  rechazado: "bg-red-500/10 text-red-300",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: ganancias }, { data: saldos }, { data: estados }, { data: recientes }] =
    await Promise.all([
      supabase.from("vw_ganancias").select("*"),
      supabase.from("vw_saldos_clientes").select("saldo_disponible"),
      supabase.from("cheques").select("estado, monto"),
      supabase
        .from("cheques")
        .select("id, numero_cheque, librador, monto, estado, created_at, clientes(razon_social)")
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

  const fmtARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
  const gananciaTotal = (ganancias ?? []).reduce((a, g) => a + Number(g.ganancia_total ?? 0), 0);
  const pendiente = (saldos ?? []).reduce((a, s) => a + Math.max(0, Number(s.saldo_disponible ?? 0)), 0);
  const enCartera = (estados ?? []).filter((c) => ["aceptado", "depositado"].includes(c.estado));
  const montoCartera = enCartera.reduce((a, c) => a + Number(c.monto), 0);
  const rechazados = (estados ?? []).filter((c) => c.estado === "rechazado").length;

  const cards = [
    { titulo: "Ganancia total (fees)", valor: fmtARS.format(gananciaTotal), Icon: TrendingUp, tono: "emerald" },
    { titulo: "Pendiente a liquidar", valor: fmtARS.format(pendiente), Icon: Wallet, tono: "blue" },
    { titulo: `En cartera · ${enCartera.length} cheques`, valor: fmtARS.format(montoCartera), Icon: Layers, tono: "zinc" },
    { titulo: "Rechazos / gestionados", valor: `${rechazados} / ${(estados ?? []).length}`, Icon: AlertOctagon, tono: rechazados > 0 ? "red" : "zinc" },
  ];

  const tonos: Record<string, { chip: string; valor: string; halo: string }> = {
    emerald: { chip: "bg-emerald-500/10 text-emerald-400", valor: "text-emerald-300", halo: "hover:border-emerald-700/60 hover:shadow-emerald-900/20" },
    blue: { chip: "bg-blue-500/10 text-blue-400", valor: "text-blue-300", halo: "hover:border-blue-700/60 hover:shadow-blue-900/20" },
    red: { chip: "bg-red-500/10 text-red-400", valor: "text-red-300", halo: "hover:border-red-700/60 hover:shadow-red-900/20" },
    zinc: { chip: "bg-zinc-500/10 text-zinc-300", valor: "text-zinc-100", halo: "hover:border-zinc-600" },
  };

  return (
    <main className="p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Dashboard</h1>
          <p className="text-sm text-zinc-500">El pulso de la operación en tiempo real.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ titulo, valor, Icon, tono }) => (
            <div
              key={titulo}
              className={`rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 p-5 shadow-lg shadow-black/20 transition ${tonos[tono].halo}`}
            >
              <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${tonos[tono].chip}`}>
                <Icon size={19} />
              </div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">{titulo}</p>
              <p className={`mt-1 font-mono text-2xl font-semibold tracking-tight ${tonos[tono].valor}`}>
                {valor}
              </p>
            </div>
          ))}
        </div>

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
                    {ch.estado}
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
