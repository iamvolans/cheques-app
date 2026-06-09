import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import NuevoCliente from "@/components/clientes/nuevo-cliente";
import Liquidar from "@/components/clientes/liquidar";
import Paginador from "@/components/ui/paginador";

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

  const [{ data: perfil }, { data: clientes, count }] = await Promise.all([
    supabase.from("perfiles").select("rol").eq("id", user.id).single(),
    supabase.from("vw_saldos_clientes").select("*", { count: "exact" }).order("razon_social").range(inicio, inicio + 24),
  ]);

  const total = count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / 25));

  const esAdmin = perfil?.rol === "administrador";
  const fmtARS = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  });

  return (
    <main className="min-h-screen bg-zinc-950 p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Clientes</h1>
            <div className="flex gap-3 text-sm">
              
              
              
            </div>
          </div>
          <NuevoCliente />
        </header>

        <div className="overflow-x-auto rounded-2xl border border-zinc-800 shadow-lg shadow-black/20">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/80 text-left text-[11px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Razón Social</th>
                <th className="px-4 py-3 font-medium">CUIT</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 text-right font-medium">Fee</th>
                <th className="px-4 py-3 text-right font-medium">Saldo disponible</th>
                {esAdmin && <th className="px-4 py-3 font-medium">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 bg-zinc-950">
              {(clientes ?? []).map((c) => (
                <tr key={c.cliente_id} className="transition hover:bg-zinc-800/40">
                  <td className="px-4 py-3">
                    <Link href={`/clientes/${c.cliente_id}`} className="text-zinc-100 hover:text-emerald-400 hover:underline">
                      {c.razon_social}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-zinc-400">{c.cuit}</td>
                  <td className="px-4 py-3 text-zinc-400">{c.email ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-300">
                    {Number(c.fee_porcentaje).toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-400">
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
                  <td colSpan={esAdmin ? 6 : 5} className="px-4 py-10 text-center text-zinc-500">
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
