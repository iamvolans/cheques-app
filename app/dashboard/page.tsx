import { createClient } from "@/lib/supabase/server";
import { logout } from "@/actions/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protección de ruta: sin sesión válida → al login (una sola vez, sin bucles)
  if (!user) {
    redirect("/login");
  }

  // Trae el perfil (nombre y rol) desde la tabla que creamos en Supabase
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre, email, rol")
    .eq("id", user.id)
    .single();

  return (
    <main className="min-h-screen bg-zinc-950 p-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-50">Dashboard</h1>
            <p className="text-sm text-zinc-400">
              {perfil?.email ?? user.email} ·{" "}
              <span className="rounded bg-emerald-950 px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide text-emerald-400">
                {perfil?.rol ?? "sin perfil"}
              </span>
            </p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
            >
              Cerrar sesión
            </button>
          </form>
        </header>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-zinc-300">
            ✅ Conexión a Supabase funcionando. Acá van a vivir los KPIs:
            ganancias, pendiente a liquidar, alertas de rechazos.
          </p>
        </div>
      </div>
    </main>
  );
}
