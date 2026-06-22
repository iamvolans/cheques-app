import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { logout } from "@/actions/auth";
import SidebarNav from "@/components/shell/sidebar-nav";
import MobileNav from "@/components/shell/mobile-nav";
import Campana from "@/components/shell/campana";
import ThemeToggle from "@/components/shell/theme-toggle";
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
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-background md:flex">
        <div className="flex items-center gap-3 border-b border-border px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 font-mono text-sm font-bold text-zinc-950 shadow-lg shadow-emerald-900/40">
            GC
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight text-foreground">Gestión de Cobranza</p>
            <p className="text-[11px] text-foreground0">Cheques & E-Cheqs</p>
          </div>
        </div>
        <SidebarNav esAdmin={esAdmin} />
        <div className="border-t border-border px-5 py-3">
          <p className="flex items-center gap-2 text-[11px] text-muted-foreground/70">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            v1.2 · GOAT
          </p>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/80 px-6 py-3 backdrop-blur">
          <p className="text-sm text-foreground0 md:hidden">Gestión de Cobranza</p>
          <div className="hidden text-sm text-foreground0 md:block" />
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-sm text-foreground">{perfil?.nombre ?? perfil?.email}</p>
              <p className="text-[11px] uppercase tracking-wide text-primary">{perfil?.rol}</p>
            </div>
            <ThemeToggle />
            {esAdmin && <Campana />}
            <span title="MFA activo" className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck size={16} />
            </span>
            <form action={logout}>
              <button
                type="submit"
                title="Cerrar sesión"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-red-800 hover:text-red-400"
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
