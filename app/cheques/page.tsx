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
};

export default async function ChequesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal1") redirect("/mfa-setup");
  if (aal?.currentLevel !== "aal2") redirect("/mfa-verify");

  const [
    { data: perfil },
    { data: cheques },
    { data: clientes },
    { data: convenios },
    { data: cuentas },
  ] = await Promise.all([
    supabase.from("perfiles").select("rol").eq("id", user.id).single(),
    supabase
      .from("cheques")
      .select("*, clientes(razon_social)")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("clientes").select("id, razon_social").eq("activo", true).order("razon_social"),
    supabase.from("convenios").select("id, razon_social").eq("activo", true),
    supabase.from("cuentas_bancarias_empresa").select("id, banco, alias").eq("activa", true),
  ]);

  const esAdmin = perfil?.rol === "administrador";
  const fmtARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

  return (
    <main className="min-h-screen bg-zinc-950 p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-50">Cheques</h1>
            <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-zinc-200">
              ← Volver al dashboard
            </Link>
          </div>
          <NuevoCheque
            clientes={(clientes ?? []).map((c) => ({ id: c.id, nombre: c.razon_social }))}
            convenios={(convenios ?? []).map((c) => ({ id: c.id, nombre: c.razon_social }))}
            cuentas={(cuentas ?? []).map((c) => ({ id: c.id, nombre: `${c.banco}${c.alias ? " · " + c.alias : ""}` }))}
          />
        </header>

        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-left text-zinc-400">
              <tr>
                <th className="px-3 py-3 font-medium">N°</th>
                <th className="px-3 py-3 font-medium">Librador</th>
                <th className="px-3 py-3 font-medium">CUIT</th>
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
                <tr key={ch.id} className="transition hover:bg-zinc-900">
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
                    <span className={`rounded px-2 py-0.5 text-xs font-medium uppercase ${colorEstado[ch.estado] ?? ""}`}>
                      {ch.estado}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <AccionesCheque id={ch.id} estado={ch.estado} esAdmin={esAdmin} />
                  </td>
                </tr>
              ))}
              {(cheques ?? []).length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-zinc-500">
                    No hay cheques cargados todavía.
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
