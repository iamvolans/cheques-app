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
    INSERT: "bg-success-muted text-primary",
    UPDATE: "bg-info-muted text-info",
    DELETE: "bg-danger-muted text-danger",
  };

  return (
    <main className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 border-b border-border pb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Auditoría</h1>
          
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
                  ? "border-emerald-600 bg-success-muted text-primary"
                  : "border-border bg-card text-foreground/90 hover:border-zinc-500"
              }`}
            >
              {t.replace("_", " ")}
            </Link>
          ))}
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border shadow-lg shadow-foreground/5">
          <table className="w-full text-sm">
            <thead className="bg-card/80 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-3 font-medium">Cuándo</th>
                <th className="px-3 py-3 font-medium">Quién</th>
                <th className="px-3 py-3 font-medium">Acción</th>
                <th className="px-3 py-3 font-medium">Tabla</th>
                <th className="px-3 py-3 font-medium">Qué hizo</th>
                <th className="px-3 py-3 font-medium">Datos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background">
              {(logs ?? []).map((l) => (
                <tr key={l.id} className="align-top transition hover:bg-muted/40">
                  <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                    {new Date(l.created_at).toLocaleString("es-AR")}
                  </td>
                  <td className="px-3 py-3 text-foreground/90">{l.usuario_email ?? "sistema"}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${colorAccion[l.accion] ?? "bg-muted text-foreground/90"}`}>
                      {l.accion}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{l.tabla}</td>
                  <td className="px-3 py-3 text-foreground">{l.descripcion}</td>
                  <td className="px-3 py-3">
                    <details>
                      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground/90">
                        ver antes/después
                      </summary>
                      <pre className="mt-2 max-h-60 max-w-md overflow-auto rounded bg-card p-2 text-xs text-muted-foreground">
{JSON.stringify({ antes: l.valores_antes, despues: l.valores_despues }, null, 2)}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
              {(logs ?? []).length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Sin registros.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <Paginador pagina={pagina} totalPaginas={totalPaginas} total={total} />
      </div>
    </main>
  );
}
