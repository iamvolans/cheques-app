import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { logout } from "@/actions/auth";
import SidebarNav from "@/components/shell/sidebar-nav";
import MobileNav from "@/components/shell/mobile-nav";
import Campana from "@/components/shell/campana";
import { LogOut, ShieldCheck } from "lucide-react";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal1") redirect("/mfa-setup");
  if (aal?.currentLevel !== "aal2") redirect("/mfa-verify");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre, email, rol")
    .eq("id", user.id)
    .single();

  const esAdmin = perfil?.rol === "administrador";

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-800/70 bg-zinc-950 md:flex">
        <div className="flex items-center gap-3 border-b border-zinc-800/70 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 font-mono text-sm font-bold text-zinc-950 shadow-lg shadow-emerald-900/40">
            GC
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight text-zinc-50">Gestión de Cobranza</p>
            <p className="text-[11px] text-zinc-500">Cheques & E-Cheqs</p>
          </div>
        </div>
        <SidebarNav esAdmin={esAdmin} />
        <div className="border-t border-zinc-800/70 px-5 py-3">
          <p className="flex items-center gap-2 text-[11px] text-zinc-600">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            v1.2 · GOAT
          </p>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-zinc-800/70 bg-zinc-950/80 px-6 py-3 backdrop-blur">
          <p className="text-sm text-zinc-500 md:hidden">Gestión de Cobranza</p>
          <div className="hidden text-sm text-zinc-500 md:block" />
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-sm text-zinc-200">{perfil?.nombre ?? perfil?.email}</p>
              <p className="text-[11px] uppercase tracking-wide text-emerald-400">{perfil?.rol}</p>
            </div>
            {esAdmin && <Campana />}
            <span title="MFA activo" className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
              <ShieldCheck size={16} />
            </span>
            <form action={logout}>
              <button
                type="submit"
                title="Cerrar sesión"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 text-zinc-400 transition hover:border-red-800 hover:text-red-400"
              >
                <LogOut size={15} />
              </button>
            </form>
          </div>
        </header>
        <MobileNav esAdmin={esAdmin} />
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
