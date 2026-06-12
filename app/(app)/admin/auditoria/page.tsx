import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Paginador from "@/components/ui/paginador";
import ExportarXls from "@/components/ui/exportar-xls";

const TABLAS = ["todas", "cheques", "clientes", "liquidaciones", "movimientos_clientes"];

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ tabla?: string; page?: string }>;
}) {
  const { tabla, page } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal1") redirect("/mfa-setup");
  if (aal?.currentLevel !== "aal2") redirect("/mfa-verify");

  const { data: miPerfil } = await supabase
    .from("perfiles").select("rol").eq("id", user.id).single();
  if (miPerfil?.rol !== "administrador") redirect("/dashboard");

  const pagina = Math.max(1, Number(page) || 1);
  const inicio = (pagina - 1) * 25;

  let query = supabase
    .from("logs_auditoria")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(inicio, inicio + 24);
  if (tabla && tabla !== "todas") query = query.eq("tabla", tabla);
  const { data: logs, count } = await query;

  const total = count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / 25));

  const colorAccion: Record<string, string> = {
    INSERT: "bg-emerald-950 text-emerald-300",
    UPDATE: "bg-blue-950 text-blue-300",
    DELETE: "bg-red-950 text-red-300",
  };

  return (
    <main className="min-h-screen bg-zinc-950 p-4 sm:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 border-b border-zinc-800 pb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Auditoría</h1>
          
        </header>

        <div className="mb-4 flex justify-end">
          <ExportarXls endpoint={tabla && tabla !== "todas" ? `/api/export/auditoria?tabla=${tabla}` : "/api/export/auditoria"} />
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {TABLAS.map((t) => (
            <Link
              key={t}
              href={t === "todas" ? "/admin/auditoria" : `/admin/auditoria?tabla=${t}`}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                (tabla ?? "todas") === t
                  ? "border-emerald-600 bg-emerald-950 text-emerald-300"
                  : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
              }`}
            >
              {t.replace("_", " ")}
            </Link>
          ))}
        </div>

        <div className="overflow-x-auto rounded-2xl border border-zinc-800 shadow-lg shadow-black/20">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/80 text-left text-[11px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-3 font-medium">Cuándo</th>
                <th className="px-3 py-3 font-medium">Quién</th>
                <th className="px-3 py-3 font-medium">Acción</th>
                <th className="px-3 py-3 font-medium">Tabla</th>
                <th className="px-3 py-3 font-medium">Qué hizo</th>
                <th className="px-3 py-3 font-medium">Datos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 bg-zinc-950">
              {(logs ?? []).map((l) => (
                <tr key={l.id} className="align-top transition hover:bg-zinc-800/40">
                  <td className="px-3 py-3 font-mono text-xs text-zinc-400">
                    {new Date(l.created_at).toLocaleString("es-AR")}
                  </td>
                  <td className="px-3 py-3 text-zinc-300">{l.usuario_email ?? "sistema"}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${colorAccion[l.accion] ?? "bg-zinc-800 text-zinc-300"}`}>
                      {l.accion}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-zinc-400">{l.tabla}</td>
                  <td className="px-3 py-3 text-zinc-100">{l.descripcion}</td>
                  <td className="px-3 py-3">
                    <details>
                      <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">
                        ver antes/después
                      </summary>
                      <pre className="mt-2 max-h-60 max-w-md overflow-auto rounded bg-zinc-900 p-2 text-xs text-zinc-400">
{JSON.stringify({ antes: l.valores_antes, despues: l.valores_despues }, null, 2)}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
              {(logs ?? []).length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-zinc-500">Sin registros.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <Paginador pagina={pagina} totalPaginas={totalPaginas} total={total} />
      </div>
    </main>
  );
}
