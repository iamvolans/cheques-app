import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import NuevoUsuario from "@/components/admin/nuevo-usuario";
import FilaUsuario from "@/components/admin/fila-usuario";

export default async function UsuariosPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal1") redirect("/mfa-setup");
  if (aal?.currentLevel !== "aal2") redirect("/mfa-verify");

  const { data: miPerfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();

  // Pantalla exclusiva de administradores
  if (miPerfil?.rol !== "administrador") redirect("/dashboard");

  const { data: usuarios } = await supabase
    .from("perfiles")
    .select("*")
    .order("created_at");

  return (
    <main className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-center justify-between border-b border-border pb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Usuarios</h1>
            
          </div>
          <NuevoUsuario />
        </header>

        <div className="overflow-x-auto rounded-2xl border border-border shadow-lg shadow-foreground/5">
          <table className="w-full text-sm">
            <thead className="bg-card/80 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Rol y acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background">
              {(usuarios ?? []).map((u) => (
                <tr key={u.id} className="transition hover:bg-muted/40">
                  <td className="px-4 py-3 text-foreground">{u.nombre}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full whitespace-nowrap px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        u.activo
                          ? "bg-success-muted text-primary"
                          : "bg-danger-muted text-danger"
                      }`}
                    >
                      {u.activo ? "Activo" : "Desactivado"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <FilaUsuario
                      id={u.id}
                      rol={u.rol}
                      activo={u.activo}
                      esYoMismo={u.id === user.id}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
