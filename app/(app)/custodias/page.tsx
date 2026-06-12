import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Calendario from "@/components/custodias/calendario";

export default async function CustodiasPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal1") redirect("/mfa-setup");
  if (aal?.currentLevel !== "aal2") redirect("/mfa-verify");

  const { data: custodias } = await supabase
    .from("cheques")
    .select("id, numero_cheque, librador, monto, fecha_cobro, clientes(razon_social)")
    .eq("estado", "en_custodia")
    .order("fecha_cobro");

  const items = (custodias ?? []).map((c) => ({
    id: c.id,
    numero_cheque: c.numero_cheque,
    librador: c.librador,
    monto: Number(c.monto),
    fecha_cobro: c.fecha_cobro,
    cliente: (c.clientes as unknown as { razon_social?: string } | null)?.razon_social ?? "",
  }));

  const total = items.reduce((a, x) => a + x.monto, 0);
  const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

  return (
    <main className="min-h-screen bg-zinc-950 p-4 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 border-b border-zinc-800 pb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Calendario de custodias</h1>
          <p className="mt-1 text-sm text-zinc-500">{items.length} cheques diferidos en custodia · total {fmt.format(total)}</p>
        </header>
        {items.length === 0 ? (
          <p className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-10 text-center text-sm text-zinc-500">No hay cheques en custodia.</p>
        ) : (
          <Calendario items={items} />
        )}
      </div>
    </main>
  );
}
