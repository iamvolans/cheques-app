import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import NuevoCliente from "@/components/clientes/nuevo-cliente";
import Liquidar from "@/components/clientes/liquidar";
import Paginador from "@/components/ui/paginador";
import Sparkline from "@/components/ui/sparkline";

export default async function ClientesPage({
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

  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal1") redirect("/mfa-setup");
  if (aal?.currentLevel !== "aal2") redirect("/mfa-verify");

  const pagina = Math.max(1, Number(sp.page) || 1);
  const inicio = (pagina - 1) * 25;

  const [{ data: perfil }, { data: clientes, count }, { data: tendencias }] = await Promise.all([
    supabase.from("perfiles").select("rol").eq("id", user.id).single(),
    supabase.from("vw_saldos_clientes").select("*", { count: "exact" }).order("razon_social").range(inicio, inicio + 24),
    supabase.from("vw_tendencia_cliente").select("*"),
  ]);

  const seriePorCliente = new Map<string, number[]>();
  for (const t of tendencias ?? []) {
    seriePorCliente.set(t.cliente_id, (t.serie_volumen ?? []).map((v: unknown) => Number(v)));
  }

  const total = count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / 25));

  const esAdmin = perfil?.rol === "administrador";
  const fmtARS = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  });

  return (
    <main className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-center justify-between border-b border-border pb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Clientes</h1>
            <div className="flex gap-3 text-sm">
              
              
              
            </div>
          </div>
          <NuevoCliente />
        </header>

        <div className="overflow-x-auto rounded-2xl border border-border shadow-lg shadow-foreground/5">
          <table className="w-full text-sm">
            <thead className="bg-card/80 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Razón Social</th>
                <th className="px-4 py-3 font-medium">CUIT</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 text-right font-medium">Fee</th>
                <th className="px-4 py-3 font-medium">Tendencia 6m</th>
                <th className="px-4 py-3 text-right font-medium">Saldo disponible</th>
                {esAdmin && <th className="px-4 py-3 font-medium">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background">
              {(clientes ?? []).map((c) => (
                <tr key={c.cliente_id} className="transition hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link href={`/clientes/${c.cliente_id}`} className="text-foreground hover:text-primary hover:underline">
                      {c.razon_social}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{c.cuit}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.email ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono text-foreground/90">
                    {Number(c.fee_porcentaje).toFixed(2)}%
                  </td>
                  <td className="px-4 py-3">
                    <Sparkline datos={seriePorCliente.get(c.cliente_id) ?? []} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-primary">
                    {fmtARS.format(Number(c.saldo_disponible))}
                  </td>
                  {esAdmin && (
                    <td className="px-4 py-3">
                      <Liquidar
                        clienteId={c.cliente_id}
                        saldo={Number(c.saldo_disponible)}
                      />
                    </td>
                  )}
                </tr>
              ))}
              {(clientes ?? []).length === 0 && (
                <tr>
                  <td colSpan={esAdmin ? 7 : 6} className="px-4 py-10 text-center text-muted-foreground">
                    Todavía no hay clientes cargados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Paginador pagina={pagina} totalPaginas={totalPaginas} total={total} />
      </div>
    </main>
  );
}
