import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import NuevoCliente from "@/components/clientes/nuevo-cliente";

export default async function ClientesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal1") redirect("/mfa-setup");
  if (aal?.currentLevel !== "aal2") redirect("/mfa-verify");

  const { data: clientes } = await supabase
    .from("vw_saldos_clientes")
    .select("*")
    .order("razon_social");

  const fmtARS = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  });

  return (
    <main className="min-h-screen bg-zinc-950 p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-50">Clientes</h1>
            <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-zinc-200">
              ← Volver al dashboard
            </Link>
          </div>
          <NuevoCliente />
        </header>

        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-left text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Razón Social</th>
                <th className="px-4 py-3 font-medium">CUIT</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 text-right font-medium">Fee</th>
                <th className="px-4 py-3 text-right font-medium">Saldo disponible</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 bg-zinc-950">
              {(clientes ?? []).map((c) => (
                <tr key={c.cliente_id} className="transition hover:bg-zinc-900">
                  <td className="px-4 py-3 text-zinc-100">{c.razon_social}</td>
                  <td className="px-4 py-3 font-mono text-zinc-400">{c.cuit}</td>
                  <td className="px-4 py-3 text-zinc-400">{c.email ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-300">
                    {Number(c.fee_porcentaje).toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-400">
                    {fmtARS.format(Number(c.saldo_disponible))}
                  </td>
                </tr>
              ))}
              {(clientes ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-zinc-500">
                    Todavía no hay clientes cargados. Creá el primero con el botón de arriba.
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
