import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import NuevoCheque from "@/components/cheques/nuevo-cheque";
import AccionesCheque from "@/components/cheques/acciones-cheque";
import Paginador from "@/components/ui/paginador";
import ExportarXls from "@/components/ui/exportar-xls";

export const maxDuration = 60; // las subidas a Drive pueden tardar

const colorEstado: Record<string, string> = {
  aceptado: "bg-muted text-foreground/90",
  depositado: "bg-info-muted text-info",
  procesado: "bg-success-muted text-primary",
  rechazado: "bg-danger-muted text-danger",
  en_custodia: "bg-warning-muted text-warning",
};

type Filtros = {
  desde?: string;
  hasta?: string;
  cliente?: string;
  estado?: string;
  q?: string;
  page?: string;
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

  // Paginación
  const pagina = Math.max(1, Number(f.page) || 1);
  const inicio = (pagina - 1) * 25;
  const qTexto = (f.q ?? "").trim().replace(/[,()%]/g, "");

  // Página de cheques (con conteo total) + suma de montos sobre TODO el filtro
  let qCheques = supabase
    .from("cheques")
    .select("*, clientes(razon_social), cuentas_bancarias_empresa(multa_rechazo_banco)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(inicio, inicio + 24);
  let qMonto = supabase.from("cheques").select("monto");

  if (f.desde) { qCheques = qCheques.gte("fecha_cobro", f.desde); qMonto = qMonto.gte("fecha_cobro", f.desde); }
  if (f.hasta) { qCheques = qCheques.lte("fecha_cobro", f.hasta); qMonto = qMonto.lte("fecha_cobro", f.hasta); }
  if (f.cliente) { qCheques = qCheques.eq("cliente_id", f.cliente); qMonto = qMonto.eq("cliente_id", f.cliente); }
  if (f.estado) { qCheques = qCheques.eq("estado", f.estado); qMonto = qMonto.eq("estado", f.estado); }
  if (qTexto) {
    const filtro = `numero_cheque.ilike.%${qTexto}%,cuit_librador.ilike.%${qTexto}%`;
    qCheques = qCheques.or(filtro);
    qMonto = qMonto.or(filtro);
  }

  const hayFiltros = Boolean(f.desde || f.hasta || f.cliente || f.estado || f.q);

  const [
    { data: perfil },
    { data: cheques, count: totalCheques },
    { data: montos },
    { data: clientes },
    { data: convenios },
    { data: cuentas },
  ] = await Promise.all([
    supabase.from("perfiles").select("rol").eq("id", user.id).single(),
    qCheques,
    qMonto,
    supabase.from("clientes").select("id, razon_social").eq("activo", true).order("razon_social"),
    supabase.from("convenios").select("id, razon_social").eq("activo", true),
    supabase.from("cuentas_bancarias_empresa").select("id, banco, alias").eq("activa", true),
  ]);

  const total = totalCheques ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / 25));
  const sumaMonto = (montos ?? []).reduce((a, m) => a + Number(m.monto), 0);

  const esAdmin = perfil?.rol === "administrador";
  const hoy = new Date().toISOString().slice(0, 10);
  const fmtARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

  const lblCls = "flex flex-col gap-1 text-[11px] uppercase tracking-wide text-muted-foreground";
  const inputCls =
    "rounded-lg border border-border bg-background px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/15";

  return (
    <main className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 border-b border-border pb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Cheques</h1>
        </header>

        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <ExportarXls endpoint="/api/export/cheques" />
        </div>

        <div className="mb-5 flex justify-end">
          <NuevoCheque
            clientes={(clientes ?? []).map((c) => ({ id: c.id, nombre: c.razon_social }))}
            convenios={(convenios ?? []).map((c) => ({ id: c.id, nombre: c.razon_social }))}
            cuentas={(cuentas ?? []).map((c) => ({ id: c.id, nombre: `${c.banco}${c.alias ? " · " + c.alias : ""}` }))}
          />
        </div>

        {/* Barra de filtros */}
        <form
          method="get"
          className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-gradient-to-b from-card to-background p-4 shadow-lg shadow-foreground/5"
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
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-md shadow-emerald-950/50 transition hover:bg-primary"
          >
            Filtrar
          </button>
          {hayFiltros && (
            <Link
              href="/cheques"
              className="rounded-lg border border-border px-4 py-2 text-sm text-foreground/90 transition hover:bg-muted"
            >
              Limpiar
            </Link>
          )}
        </form>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="bg-card/80 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
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
            <tbody className="divide-y divide-border bg-background">
              {(cheques ?? []).map((ch) => (
                <tr key={ch.id} className="transition hover:bg-muted/40">
                  <td className="px-3 py-3 font-mono text-foreground/90">
                    <Link href={`/cheques/${ch.id}`} className="hover:text-primary hover:underline">{ch.numero_cheque}</Link>
                    {ch.tipo === "echeq" && (
                      <span className="ml-1 rounded bg-info-muted px-1 text-xs text-info">E</span>
                    )}
                    {ch.foto_frente_url && (
                      <a href={ch.foto_frente_url} target="_blank" rel="noreferrer" className="ml-1 text-xs text-primary hover:underline">F</a>
                    )}
                    {ch.foto_dorso_url && (
                      <a href={ch.foto_dorso_url} target="_blank" rel="noreferrer" className="ml-1 text-xs text-primary hover:underline">D</a>
                    )}
                    {ch.pdf_endoso_url && (
                      <a href={ch.pdf_endoso_url} target="_blank" rel="noreferrer" className="ml-1 text-xs text-primary hover:underline">PDF</a>
                    )}
                  </td>
                  <td className="px-3 py-3 text-foreground">
                    {ch.alerta_lista_negra && <span title="Librador en lista negra">⚠ </span>}
                    {ch.librador}
                  </td>
                  <td className="px-3 py-3 font-mono text-muted-foreground">{ch.cuit_librador}</td>
                  <td className="px-3 py-3">
                    {ch.plaza === "camara" && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">Cámara</span>}
                    {ch.plaza === "interior" && <span className="rounded-full bg-info/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-info">Interior</span>}
                    {!ch.plaza && <span className="text-muted-foreground/70">—</span>}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{ch.clientes?.razon_social}</td>
                  <td className="px-3 py-3 text-right font-mono text-foreground">
                    {fmtARS.format(Number(ch.monto))}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-muted-foreground">
                    {fmtARS.format(Number(ch.fee_calculado))}
                  </td>
                  <td className="px-3 py-3 font-mono text-muted-foreground">{ch.fecha_cobro}</td>
                  <td className="px-3 py-3 font-mono text-muted-foreground">
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
                  <td colSpan={11} className="px-4 py-10 text-center text-muted-foreground">
                    {hayFiltros ? "Sin resultados para esos filtros." : "No hay cheques cargados todavía."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Paginador pagina={pagina} totalPaginas={totalPaginas} total={total} totalMonto={fmtARS.format(sumaMonto)} />
      </div>
    </main>
  );
}
