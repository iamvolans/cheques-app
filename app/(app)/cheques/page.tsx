import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import NuevoCheque from "@/components/cheques/nuevo-cheque";
import AccionesCheque from "@/components/cheques/acciones-cheque";

const colorEstado: Record<string, string> = {
  aceptado: "bg-zinc-800 text-zinc-300",
  depositado: "bg-blue-950 text-blue-300",
  procesado: "bg-emerald-950 text-emerald-300",
  rechazado: "bg-red-950 text-red-300",
  en_custodia: "bg-amber-950 text-amber-300",
};

type Filtros = {
  desde?: string;
  hasta?: string;
  cliente?: string;
  estado?: string;
  q?: string;
};

export default async function ChequesPage({
  searchParams,
}: {
  searchParams: Promise<Filtros>;
}) {
  const f = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal1") redirect("/mfa-setup");
  if (aal?.currentLevel !== "aal2") redirect("/mfa-verify");

  // Consulta de cheques con filtros server-side
  let qCheques = supabase
    .from("cheques")
    .select("*, clientes(razon_social), cuentas_bancarias_empresa(multa_rechazo_banco)")
    .order("created_at", { ascending: false })
    .limit(300);

  if (f.desde) qCheques = qCheques.gte("fecha_cobro", f.desde);
  if (f.hasta) qCheques = qCheques.lte("fecha_cobro", f.hasta);
  if (f.cliente) qCheques = qCheques.eq("cliente_id", f.cliente);
  if (f.estado) qCheques = qCheques.eq("estado", f.estado);
  if (f.q) {
    const q = f.q.trim().replace(/[,()%]/g, "");
    if (q) qCheques = qCheques.or(`numero_cheque.ilike.%${q}%,cuit_librador.ilike.%${q}%`);
  }

  const hayFiltros = Boolean(f.desde || f.hasta || f.cliente || f.estado || f.q);

  const [
    { data: perfil },
    { data: cheques },
    { data: clientes },
    { data: convenios },
    { data: cuentas },
  ] = await Promise.all([
    supabase.from("perfiles").select("rol").eq("id", user.id).single(),
    qCheques,
    supabase.from("clientes").select("id, razon_social").eq("activo", true).order("razon_social"),
    supabase.from("convenios").select("id, razon_social").eq("activo", true),
    supabase.from("cuentas_bancarias_empresa").select("id, banco, alias").eq("activa", true),
  ]);

  const esAdmin = perfil?.rol === "administrador";
  const hoy = new Date().toISOString().slice(0, 10);
  const fmtARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

  const lblCls = "flex flex-col gap-1 text-[11px] uppercase tracking-wide text-zinc-500";
  const inputCls =
    "rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm normal-case tracking-normal text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15";

  return (
    <main className="min-h-screen bg-zinc-950 p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Cheques</h1>
          </div>
          <NuevoCheque
            clientes={(clientes ?? []).map((c) => ({ id: c.id, nombre: c.razon_social }))}
            convenios={(convenios ?? []).map((c) => ({ id: c.id, nombre: c.razon_social }))}
            cuentas={(cuentas ?? []).map((c) => ({ id: c.id, nombre: `${c.banco}${c.alias ? " · " + c.alias : ""}` }))}
          />
        </header>

        {/* Barra de filtros */}
        <form
          method="get"
          className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 p-4 shadow-lg shadow-black/20"
        >
          <label className={`${lblCls} min-w-52 flex-1`}>
            Buscar
            <input
              name="q"
              defaultValue={f.q ?? ""}
              placeholder="N° de cheque o CUIT del librador…"
              className={inputCls}
            />
          </label>
          <label className={lblCls}>
            Cobro desde
            <input name="desde" type="date" defaultValue={f.desde ?? ""} className={inputCls} />
          </label>
          <label className={lblCls}>
            Cobro hasta
            <input name="hasta" type="date" defaultValue={f.hasta ?? ""} className={inputCls} />
          </label>
          <label className={lblCls}>
            Cliente
            <select name="cliente" defaultValue={f.cliente ?? ""} className={inputCls}>
              <option value="">Todos</option>
              {(clientes ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.razon_social}</option>
              ))}
            </select>
          </label>
          <label className={lblCls}>
            Estado
            <select name="estado" defaultValue={f.estado ?? ""} className={inputCls}>
              <option value="">Todos</option>
              <option value="en_custodia">En custodia (diferidos)</option>
              <option value="aceptado">Aceptado</option>
              <option value="depositado">Depositado</option>
              <option value="procesado">Procesado</option>
              <option value="rechazado">Rechazado</option>
            </select>
          </label>
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-emerald-950/50 transition hover:bg-emerald-500"
          >
            Filtrar
          </button>
          {hayFiltros && (
            <Link
              href="/cheques"
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800"
            >
              Limpiar
            </Link>
          )}
        </form>

        {hayFiltros && (
          <p className="mb-3 text-xs text-zinc-500">
            {(cheques ?? []).length} resultado{(cheques ?? []).length === 1 ? "" : "s"} con los filtros aplicados
            {(cheques ?? []).length === 300 && " (mostrando los primeros 300 — refiná la búsqueda)"}
          </p>
        )}

        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/80 text-left text-[11px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-3 font-medium">N°</th>
                <th className="px-3 py-3 font-medium">Librador</th>
                <th className="px-3 py-3 font-medium">CUIT</th>
                <th className="px-3 py-3 font-medium">Plaza</th>
                <th className="px-3 py-3 font-medium">Cliente</th>
                <th className="px-3 py-3 text-right font-medium">Monto</th>
                <th className="px-3 py-3 text-right font-medium">Fee</th>
                <th className="px-3 py-3 font-medium">Cobro</th>
                <th className="px-3 py-3 font-medium">Acred. est.</th>
                <th className="px-3 py-3 font-medium">Estado</th>
                <th className="px-3 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 bg-zinc-950">
              {(cheques ?? []).map((ch) => (
                <tr key={ch.id} className="transition hover:bg-zinc-800/40">
                  <td className="px-3 py-3 font-mono text-zinc-300">
                    <Link href={`/cheques/${ch.id}`} className="hover:text-emerald-400 hover:underline">{ch.numero_cheque}</Link>
                    {ch.tipo === "echeq" && (
                      <span className="ml-1 rounded bg-violet-950 px-1 text-xs text-violet-300">E</span>
                    )}
                    {ch.foto_frente_url && (
                      <a href={ch.foto_frente_url} target="_blank" rel="noreferrer" className="ml-1 text-xs text-emerald-400 hover:underline">F</a>
                    )}
                    {ch.foto_dorso_url && (
                      <a href={ch.foto_dorso_url} target="_blank" rel="noreferrer" className="ml-1 text-xs text-emerald-400 hover:underline">D</a>
                    )}
                    {ch.pdf_endoso_url && (
                      <a href={ch.pdf_endoso_url} target="_blank" rel="noreferrer" className="ml-1 text-xs text-emerald-400 hover:underline">PDF</a>
                    )}
                  </td>
                  <td className="px-3 py-3 text-zinc-100">
                    {ch.alerta_lista_negra && <span title="Librador en lista negra">⚠ </span>}
                    {ch.librador}
                  </td>
                  <td className="px-3 py-3 font-mono text-zinc-400">{ch.cuit_librador}</td>
                  <td className="px-3 py-3">
                    {ch.plaza === "camara" && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-300">Cámara</span>}
                    {ch.plaza === "interior" && <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-violet-300">Interior</span>}
                    {!ch.plaza && <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="px-3 py-3 text-zinc-400">{ch.clientes?.razon_social}</td>
                  <td className="px-3 py-3 text-right font-mono text-zinc-100">
                    {fmtARS.format(Number(ch.monto))}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-zinc-400">
                    {fmtARS.format(Number(ch.fee_calculado))}
                  </td>
                  <td className="px-3 py-3 font-mono text-zinc-400">{ch.fecha_cobro}</td>
                  <td className="px-3 py-3 font-mono text-zinc-400">
                    {ch.fecha_estimada_acred ?? "—"}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full whitespace-nowrap px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${colorEstado[ch.estado] ?? ""}`}>
                      {ch.estado === "en_custodia" ? "custodia" : ch.estado}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <AccionesCheque
                      id={ch.id}
                      estado={ch.estado}
                      esAdmin={esAdmin}
                      disponible={ch.fecha_cobro <= hoy}
                      multaBanco={Number((ch.cuentas_bancarias_empresa as unknown as { multa_rechazo_banco?: number } | null)?.multa_rechazo_banco ?? 0)}
                    />
                  </td>
                </tr>
              ))}
              {(cheques ?? []).length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-zinc-500">
                    {hayFiltros ? "Sin resultados para esos filtros." : "No hay cheques cargados todavía."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
