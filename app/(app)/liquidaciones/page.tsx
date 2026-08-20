import { createClient } from "@/lib/supabase/server";
import SolicitudesPendientes from "@/components/liquidaciones/solicitudes-pendientes";
import ConcentracionDestinos from "@/components/liquidaciones/concentracion-destinos";
import Paginador from "@/components/ui/paginador";
import ExportarXls from "@/components/ui/exportar-xls";
import AccionesLiquidacion from "@/components/liquidaciones/acciones-liquidacion";
import { redirect } from "next/navigation";
import Link from "next/link";

type Filtros = {
  page?: string;
  q?: string;
  desde?: string;
  hasta?: string;
  montoDesde?: string;
  montoHasta?: string;
  cliente?: string;
};

export default async function LiquidacionesPage({
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

  const pagina = Math.max(1, Number(f.page) || 1);
  const inicio = (pagina - 1) * 25;
  const qTexto = (f.q ?? "").trim().replace(/[,()%]/g, "");

  let qLiqs = supabase
    .from("liquidaciones")
    .select("*, clientes(razon_social)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(inicio, inicio + 24);

  if (f.desde) { qLiqs = qLiqs.gte("fecha_transferencia", f.desde); }
  if (f.hasta) { qLiqs = qLiqs.lte("fecha_transferencia", f.hasta); }
  if (f.cliente) { qLiqs = qLiqs.eq("cliente_id", f.cliente); }
  if (f.montoDesde && !isNaN(Number(f.montoDesde))) { qLiqs = qLiqs.gte("monto_liquidado", Number(f.montoDesde)); }
  if (f.montoHasta && !isNaN(Number(f.montoHasta))) { qLiqs = qLiqs.lte("monto_liquidado", Number(f.montoHasta)); }
  if (qTexto) {
    const filtro = `beneficiario.ilike.%${qTexto}%,cuit_beneficiario.ilike.%${qTexto}%,coelsa_id.ilike.%${qTexto}%`;
    qLiqs = qLiqs.or(filtro);
   
  }

  const [{ data: perfil }, { data: liqs, count }, { data: sumaRpc }, { data: clientes }] = await Promise.all([
    supabase.from("perfiles").select("rol").eq("id", user.id).single(),
    qLiqs,
    supabase.rpc("fn_suma_liquidaciones", {
      p_desde: f.desde ?? null,
      p_hasta: f.hasta ?? null,
      p_cliente: f.cliente ?? null,
      p_monto_desde: f.montoDesde && !isNaN(Number(f.montoDesde)) ? Number(f.montoDesde) : null,
      p_monto_hasta: f.montoHasta && !isNaN(Number(f.montoHasta)) ? Number(f.montoHasta) : null,
      p_texto: qTexto || null,
    }),
    supabase.from("clientes").select("id, razon_social").order("razon_social"),
  ]);
  const esAdmin = perfil?.rol === "administrador";

  const total = count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / 25));
  const sumaMonto = Number(sumaRpc ?? 0);
  const fmtARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
  const hayFiltros = Boolean(f.q || f.desde || f.hasta || f.cliente || f.montoDesde || f.montoHasta);

  const lblCls = "flex flex-col gap-1 text-[11px] uppercase tracking-wide text-muted-foreground";
  const inputCls =
    "rounded-lg border border-border bg-background px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/15";

  return (
    <main className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Liquidaciones</h1>
          <p className="text-sm text-muted-foreground">
            {total} registro{total === 1 ? "" : "s"} · total filtrado{" "}
            <span className="font-mono text-primary">{fmtARS.format(sumaMonto)}</span>
          </p>
        </header>

        <div className="mb-4 flex justify-end">
          <ExportarXls endpoint="/api/export/liquidaciones" conFechas={false} />
        </div>

        <SolicitudesPendientes />

        <ConcentracionDestinos esAdmin={true} />

        {/* Barra de filtros */}
        <form
          method="get"
          className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-gradient-to-b from-card to-background p-4 shadow-lg shadow-foreground/5"
        >
          <label className={`${lblCls} min-w-52 flex-1`}>
            Buscar
            <input name="q" defaultValue={f.q ?? ""} placeholder="Beneficiario, CUIT o Coelsa ID" className={inputCls} />
          </label>
          <label className={lblCls}>
            Desde
            <input name="desde" type="date" min="2000-01-01" max="2100-01-01" defaultValue={f.desde ?? ""} className={inputCls} />
          </label>
          <label className={lblCls}>
            Hasta
            <input name="hasta" type="date" min="2000-01-01" max="2100-01-01" defaultValue={f.hasta ?? ""} className={inputCls} />
          </label>
          <label className={lblCls}>
            Importe desde
            <input name="montoDesde" type="number" min="0" step="0.01" defaultValue={f.montoDesde ?? ""} placeholder="0" className={inputCls} />
          </label>
          <label className={lblCls}>
            Importe hasta
            <input name="montoHasta" type="number" min="0" step="0.01" defaultValue={f.montoHasta ?? ""} placeholder="Sin tope" className={inputCls} />
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
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-md shadow-emerald-950/50 transition hover:bg-primary"
          >
            Filtrar
          </button>
          {hayFiltros && (
            <Link href="/liquidaciones" className="rounded-lg border border-border px-4 py-2 text-sm text-foreground/90 transition hover:bg-muted">
              Limpiar
            </Link>
          )}
        </form>

        <div className="overflow-x-auto rounded-2xl border border-border shadow-lg shadow-foreground/5">
          <table className="w-full text-sm">
            <thead className="bg-card/80 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Coelsa ID</th>
                <th className="px-4 py-3 font-medium">CBU/CVU destino</th>
                <th className="px-4 py-3 font-medium">Beneficiario</th>
                <th className="px-4 py-3 text-right font-medium">Monto</th>
                {esAdmin && <th className="px-4 py-3 font-medium">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background">
              {(liqs ?? []).map((l) => (
                <tr key={l.id} className="transition hover:bg-muted/40">
                  <td className="px-4 py-3 font-mono text-muted-foreground">{l.fecha_transferencia}</td>
                  <td className="px-4 py-3 text-foreground">{l.clientes?.razon_social}</td>
                  <td className="px-4 py-3 font-mono text-foreground/90">{l.coelsa_id}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{l.cvu_cbu_destino ?? l.alias_destino}</td>
                  <td className="px-4 py-3 text-muted-foreground">{l.beneficiario}</td>
                  <td className="px-4 py-3 text-right font-mono text-primary">
                    {fmtARS.format(Number(l.monto_liquidado))}
                  </td>
                  {esAdmin && (
                    <td className="px-4 py-3">
                      <AccionesLiquidacion id={l.id} monto={Number(l.monto_liquidado)} />
                    </td>
                  )}
                </tr>
              ))}
              {(liqs ?? []).length === 0 && (
                <tr>
                  <td colSpan={esAdmin ? 7 : 6} className="px-4 py-10 text-center text-muted-foreground">
                    {hayFiltros ? "Sin resultados para esos filtros." : "No hay liquidaciones registradas."}
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
