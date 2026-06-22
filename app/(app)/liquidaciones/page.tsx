import { createClient } from "@/lib/supabase/server";
import SolicitudesPendientes from "@/components/liquidaciones/solicitudes-pendientes";
import ConcentracionDestinos from "@/components/liquidaciones/concentracion-destinos";
import Paginador from "@/components/ui/paginador";
import ExportarXls from "@/components/ui/exportar-xls";
import AccionesLiquidacion from "@/components/liquidaciones/acciones-liquidacion";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function LiquidacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal1") redirect("/mfa-setup");
  if (aal?.currentLevel !== "aal2") redirect("/mfa-verify");

  const pagina = Math.max(1, Number(sp.page) || 1);
  const inicio = (pagina - 1) * 25;

  const [{ data: perfil }, { data: liqs, count }, { data: montos }] = await Promise.all([
    supabase.from("perfiles").select("rol").eq("id", user.id).single(),
    supabase
      .from("liquidaciones")
      .select("*, clientes(razon_social)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(inicio, inicio + 24),
    supabase.from("liquidaciones").select("monto_liquidado"),
  ]);
  const esAdmin = perfil?.rol === "administrador";

  const total = count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / 25));
  const sumaMonto = (montos ?? []).reduce((a, m) => a + Number(m.monto_liquidado), 0);
  const fmtARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

  return (
    <main className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 border-b border-border pb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Liquidaciones</h1>
          <div className="flex gap-3 text-sm">
            
            
          </div>
        </header>

        <div className="mb-4 flex justify-end">
          <ExportarXls endpoint="/api/export/liquidaciones" />
        </div>

        <SolicitudesPendientes />

        <ConcentracionDestinos esAdmin={true} />

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
                    No hay liquidaciones registradas.
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
