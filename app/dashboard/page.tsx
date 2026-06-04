import { createClient } from "@/lib/supabase/server";
import { logout } from "@/actions/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal1") redirect("/mfa-setup");
  if (aal?.currentLevel !== "aal2") redirect("/mfa-verify");

  const [{ data: perfil }, { data: ganancias }, { data: pendientes }, { data: estados }] =
    await Promise.all([
      supabase.from("perfiles").select("nombre, email, rol").eq("id", user.id).single(),
      supabase.from("vw_ganancias").select("*"),
      supabase.from("vw_saldos_clientes").select("saldo_disponible"),
      supabase.from("cheques").select("estado, monto"),
    ]);

  const fmtARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

  const gananciaTotal = (ganancias ?? []).reduce(
    (acc, g) => acc + Number(g.ganancia_total ?? 0), 0);
  const pendienteLiquidar = (pendientes ?? []).reduce(
    (acc, p) => acc + Math.max(0, Number(p.saldo_disponible ?? 0)), 0);
  const enCartera = (estados ?? []).filter((c) =>
    ["aceptado", "depositado"].includes(c.estado));
  const montoCartera = enCartera.reduce((acc, c) => acc + Number(c.monto), 0);
  const rechazados = (estados ?? []).filter((c) => c.estado === "rechazado").length;
  const total = (estados ?? []).length;

  const cards = [
    { titulo: "Ganancia total (fees)", valor: fmtARS.format(gananciaTotal), color: "text-emerald-400" },
    { titulo: "Pendiente a liquidar", valor: fmtARS.format(pendienteLiquidar), color: "text-blue-400" },
    { titulo: `En cartera (${enCartera.length} cheques)`, valor: fmtARS.format(montoCartera), color: "text-zinc-100" },
    { titulo: "Rechazos / total gestionado", valor: `${rechazados} / ${total}`, color: rechazados > 0 ? "text-red-400" : "text-zinc-100" },
  ];

  const links = [
    { href: "/cheques", label: "Cheques" },
    { href: "/clientes", label: "Clientes" },
    { href: "/liquidaciones", label: "Liquidaciones" },
    { href: "/libradores", label: "Libradores" },
    ...(perfil?.rol === "administrador"
      ? [
          { href: "/admin/usuarios", label: "Usuarios" },
          { href: "/admin/configuracion", label: "Configuración" },
          { href: "/admin/auditoria", label: "Auditoría" },
        ]
      : []),
  ];

  return (
    <main className="min-h-screen bg-zinc-950 p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-50">Dashboard</h1>
            <p className="text-sm text-zinc-400">
              {perfil?.email ?? user.email} ·{" "}
              <span className="rounded bg-emerald-950 px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide text-emerald-400">
                {perfil?.rol}
              </span>
              <span className="ml-2 rounded bg-zinc-800 px-1.5 py-0.5 text-xs font-medium text-zinc-400">
                MFA ✓
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

        <nav className="mb-8 flex flex-wrap gap-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-emerald-600 hover:text-emerald-400"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <div key={c.titulo} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <p className="text-xs uppercase tracking-wide text-zinc-500">{c.titulo}</p>
              <p className={`mt-2 font-mono text-2xl font-semibold ${c.color}`}>{c.valor}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
